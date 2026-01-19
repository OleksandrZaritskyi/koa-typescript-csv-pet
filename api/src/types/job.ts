export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface JobError {
  rowNumber: number;
  message: string;
  row?: Record<string, string>;
}

export interface Job {
  id: string;
  filename: string;
  status: JobStatus;
  totalRows: number;
  processedRows: number;
  successCount: number;
  failedCount: number;
  errors: JobError[];
  createdAt: string;
  completedAt: string | null;
}
