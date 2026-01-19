import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { z } from 'zod';
import { Job } from 'bull';
import { csvQueue, CsvJobData } from '../services/bullQueue.js';
import { jobRepository } from '../db/jobRepository.js';
import { customerRepository, CustomerInput } from '../db/customerRepository.js';
import { config } from '../config.js';
import { jobEvents, JobProgressEvent } from '../events/jobEvents.js';
import { JobError, JobStatus } from '../types/job.js';

const BATCH_SIZE = 200;

interface ProcessingStats {
  processedRows: number;
  totalRows: number;
  successCount: number;
  failedCount: number;
}

interface ValidatedRow {
  rowNumber: number;
  data: CustomerInput;
  originalRow: Record<string, string>;
}

interface InvalidRow {
  rowNumber: number;
  message: string;
  originalRow: Record<string, string>;
}

const rowSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  email: z.string().trim().min(1, 'email is required').email('invalid email'),
  phone: z.string().optional(),
  company: z.string().trim().min(1, 'company is required')
});

const requiredHeaders = ['name', 'email', 'phone', 'company'] as const;

const headersSchema = z.array(z.string()).refine(
  (headers) => requiredHeaders.every(h => headers.includes(h)),
  (headers) => {
    const missing = requiredHeaders.filter(h => !headers.includes(h));
    return { message: `Missing required headers: ${missing.join(', ')}` };
  }
);

const emitProgress = (jobId: string, stats: ProcessingStats, status: JobStatus): void => {
  const event: JobProgressEvent = { jobId, ...stats, status };
  jobEvents.emit('progress', event);
};

async function processJob(jobId: string): Promise<void> {
  const filePath = path.join(config.uploadDir, `${jobId}.csv`);
  const job = await jobRepository.findById(jobId);
  if (!job) {
    console.error(`Job ${jobId} not found`);
    return;
  }

  const stats: ProcessingStats = {
    processedRows: 0,
    totalRows: 0,
    successCount: 0,
    failedCount: 0
  };
  const errors: JobError[] = [];

  await jobRepository.updateProgress({ id: jobId, status: 'processing' });
  emitProgress(jobId, stats, 'processing');

  const stream = fs.createReadStream(filePath);
  const parser = stream.pipe(csv());

  let rowBuffer: { rowNumber: number; raw: Record<string, string> }[] = [];
  let batchCount = 0;

  const processBatch = async () => {
    if (rowBuffer.length === 0) return;

    const batch = rowBuffer.splice(0, BATCH_SIZE);
    const validRows: ValidatedRow[] = [];
    const invalidRows: InvalidRow[] = [];
    const seenEmailsInBatch = new Set<string>();

    for (const { rowNumber, raw } of batch) {
      const parsed = rowSchema.safeParse(raw);
      if (!parsed.success) {
        invalidRows.push({
          rowNumber,
          message: parsed.error.errors[0]?.message ?? 'invalid row',
          originalRow: raw
        });
      } else if (seenEmailsInBatch.has(parsed.data.email)) {
        invalidRows.push({
          rowNumber,
          message: 'duplicate email in file',
          originalRow: raw
        });
      } else {
        seenEmailsInBatch.add(parsed.data.email);
        validRows.push({
          rowNumber,
          data: {
            jobId,
            name: parsed.data.name,
            email: parsed.data.email,
            phone: parsed.data.phone,
            company: parsed.data.company
          },
          originalRow: raw
        });
      }
    }

    for (const invalid of invalidRows) {
      stats.failedCount += 1;
      errors.push({ rowNumber: invalid.rowNumber, message: invalid.message, row: invalid.originalRow });
    }

    if (validRows.length > 0) {
      try {
        const result = await customerRepository.createBatch(validRows.map(v => v.data));
        stats.successCount += result.successCount;
        
        for (const err of result.errors) {
          const row = validRows[err.index];
          stats.failedCount += 1;
          errors.push({ rowNumber: row.rowNumber, message: err.message, row: row.originalRow });
        }
      } catch (err) {
        console.error('Batch insert error:', err);
        for (const row of validRows) {
          stats.failedCount += 1;
          errors.push({ rowNumber: row.rowNumber, message: 'database error', row: row.originalRow });
        }
      }
    }

    stats.processedRows += batch.length;
    stats.totalRows = stats.processedRows;
    batchCount++;

    if (batchCount % 10 === 0) {
      await jobRepository.updateProgress({
        id: jobId,
        ...stats,
        errors,
        status: 'processing'
      });
    }
    emitProgress(jobId, stats, 'processing');

    await new Promise<void>(r => setImmediate(r));
  };

  try {
    await new Promise<void>((resolve, reject) => {
      let streamEnded = false;
      let processing = false;
      let hasError = false;

      const checkComplete = async () => {
        if (hasError) return;
        if (streamEnded && rowBuffer.length === 0 && !processing) {
          resolve();
        } else if (rowBuffer.length >= BATCH_SIZE && !processing) {
          processing = true;
          parser.pause();
          await processBatch();
          processing = false;
          parser.resume();
          checkComplete();
        }
      };

      stream.on('error', (err: Error) => {
        hasError = true;
        reject(err);
      });
      
      parser.on('headers', (headers: string[]) => {
        const result = headersSchema.safeParse(headers);
        if (!result.success) {
          hasError = true;
          reject(new Error(result.error.errors[0].message));
          stream.destroy();
        }
      });
      
      parser.on('data', (data: Record<string, string>) => {
        if (hasError) return;
        rowBuffer.push({ rowNumber: rowBuffer.length + stats.processedRows + 1, raw: data });
        checkComplete();
      });
      
      parser.on('end', async () => {
        streamEnded = true;
        while (rowBuffer.length > 0 && !hasError) {
          await processBatch();
        }
        checkComplete();
      });
      
      parser.on('error', (err: Error) => {
        hasError = true;
        reject(err);
      });
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    errors.push({ rowNumber: 0, message: errorMessage, row: {} });
    await jobRepository.updateProgress({
      id: jobId,
      ...stats,
      errors,
      status: 'failed'
    });
    emitProgress(jobId, stats, 'failed');
    console.error(`Job ${jobId} failed: ${errorMessage}`);
    return;
  }

  await jobRepository.updateProgress({
    id: jobId,
    ...stats,
    errors,
    status: 'completed',
    completedAt: new Date()
  });

  emitProgress(jobId, stats, 'completed');
}

export function startWorker(): void {
  csvQueue.process(1, async (job: Job<CsvJobData>) => {
    console.log(`Processing job ${job.data.jobId}`);
    await processJob(job.data.jobId);
    console.log(`Completed job ${job.data.jobId}`);
  });
  console.log('Bull worker started (concurrency=1, FIFO order)');
}
