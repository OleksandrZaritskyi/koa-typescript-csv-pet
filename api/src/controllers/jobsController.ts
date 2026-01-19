import { Context } from 'koa';
import { File } from 'formidable';
import { z } from 'zod';
import { jobService } from '../services/jobService.js';
import { jobRepository } from '../db/jobRepository.js';
import { jobEvents, JobProgressEvent } from '../events/jobEvents.js';
import { JobError } from '../types/job.js';

const idSchema = z.string().uuid();

export const jobsController = {
  async upload(ctx: Context): Promise<void> {
    const requestFiles = (ctx.request as unknown as { files?: { file?: File | File[] } }).files;
    const file = requestFiles?.file;
    if (!file) {
      ctx.status = 400;
      ctx.body = { error: 'file is required' };
      return;
    }
    const filePath = Array.isArray(file) ? file[0].filepath : file.filepath;
    const originalName = Array.isArray(file) ? file[0].originalFilename : file.originalFilename;
    const result = await jobService.createFromUpload(filePath, originalName || 'upload.csv');
    ctx.body = result;
  },

  async getById(ctx: Context): Promise<void> {
    const id = idSchema.parse(ctx.params.id);
    const job = await jobService.getJob(id);
    if (!job) {
      ctx.status = 404;
      ctx.body = { error: 'Job not found' };
      return;
    }
    ctx.body = job;
  },

  async list(ctx: Context): Promise<void> {
    const jobs = await jobService.listJobs();
    ctx.body = jobs;
  },

  async stream(ctx: Context): Promise<void> {
    const id = idSchema.parse(ctx.params.id);
    const job = await jobService.getJob(id);
    if (!job) {
      ctx.status = 404;
      ctx.body = { error: 'Job not found' };
      return;
    }

    ctx.set('Content-Type', 'text/event-stream');
    ctx.set('Cache-Control', 'no-cache');
    ctx.set('Connection', 'keep-alive');
    ctx.status = 200;

    const send = (data: unknown) => {
      ctx.res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    send(job);

    let lastSendTime = 0;
    const THROTTLE_MS = 500;

    const listener = (payload: JobProgressEvent) => {
      if (payload.jobId !== id) return;

      if (payload.status === 'completed' || payload.status === 'failed') {
        send(payload);
        ctx.res.end();
        return;
      }

      const now = Date.now();
      if (now - lastSendTime >= THROTTLE_MS) {
        lastSendTime = now;
        send(payload);
      }
    };

    jobEvents.on('progress', listener);

    const closeHandler = () => {
      jobEvents.off('progress', listener);
    };

    ctx.req.on('close', closeHandler);
    ctx.req.on('error', closeHandler);

    ctx.respond = false;
  },

  async errorsCsv(ctx: Context): Promise<void> {
    const id = idSchema.parse(ctx.params.id);
    const job = await jobRepository.findById(id);
    if (!job) {
      ctx.status = 404;
      ctx.body = { error: 'Job not found' };
      return;
    }
    const errors: JobError[] = job.errors || [];
    const escape = (val: string | undefined) => `"${(val || '').replace(/"/g, '""')}"`;
    const header = 'rowNumber,name,email,phone,company,error\n';
    const rows = errors
      .map((err) => {
        const row = err.row || {};
        return `${err.rowNumber},${escape(row.name)},${escape(row.email)},${escape(row.phone)},${escape(row.company)},${escape(err.message)}`;
      })
      .join('\n');
    const csvContent = header + rows;
    ctx.set('Content-Type', 'text/csv');
    ctx.set('Content-Disposition', `attachment; filename="job-${id}-errors.csv"`);
    ctx.body = csvContent;
  }
};
