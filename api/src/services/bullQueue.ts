import Bull, { Job } from 'bull';
import { config } from '../config.js';

export interface CsvJobData {
  jobId: string;
}

export const csvQueue = new Bull<CsvJobData>('csv-processing', {
  redis: {
    host: config.redis.host,
    port: config.redis.port
  },
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 1
  }
});

csvQueue.on('error', (err: Error) => {
  console.error('Queue error:', err);
});

csvQueue.on('failed', (job: Job<CsvJobData>, err: Error) => {
  console.error(`Job ${job.data.jobId} failed:`, err);
});
