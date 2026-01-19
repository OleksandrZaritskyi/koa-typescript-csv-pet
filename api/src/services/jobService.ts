import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { config } from '../config.js';
import { jobRepository } from '../db/jobRepository.js';
import { Job } from '../types/job.js';
import { csvQueue } from './bullQueue.js';

export interface UploadResult {
  jobId: string;
}

export const jobService = {
  async createFromUpload(filePath: string, originalFilename: string): Promise<UploadResult> {
    await fs.promises.mkdir(config.uploadDir, { recursive: true });
    const jobId = uuid();
    const targetPath = path.join(config.uploadDir, `${jobId}.csv`);
    await fs.promises.rename(filePath, targetPath);
    await jobRepository.create(jobId, originalFilename || `${jobId}.csv`);
    await csvQueue.add({ jobId });  // Add to Bull queue (persisted in Redis)
    return { jobId };
  },

  async getJob(id: string): Promise<Job | null> {
    return jobRepository.findById(id);
  },

  async listJobs(): Promise<Job[]> {
    return jobRepository.list();
  }
};
