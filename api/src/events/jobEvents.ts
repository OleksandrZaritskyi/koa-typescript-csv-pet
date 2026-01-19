import { EventEmitter } from 'events';
import { JobStatus } from '../types/job.js';

export interface JobProgressEvent {
  jobId: string;
  processedRows: number;
  totalRows: number;
  successCount: number;
  failedCount: number;
  status: JobStatus;
}

export const jobEvents = new EventEmitter();

jobEvents.setMaxListeners(0);
