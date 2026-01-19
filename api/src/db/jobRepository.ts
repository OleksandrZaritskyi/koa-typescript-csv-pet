import { pool } from './pool.js';
import { Job, JobStatus, JobError } from '../types/job.js';

const mapJobRow = (row: any): Job => ({
  id: row.id,
  filename: row.filename,
  status: row.status,
  totalRows: Number(row.total_rows),
  processedRows: Number(row.processed_rows),
  successCount: Number(row.success_count),
  failedCount: Number(row.failed_count),
  errors: row.errors || [],
  createdAt: row.created_at,
  completedAt: row.completed_at
});

export const jobRepository = {
  async create(jobId: string, filename: string): Promise<Job> {
    const result = await pool.query(
      `INSERT INTO jobs (id, filename, status) VALUES ($1, $2, 'pending') RETURNING *`,
      [jobId, filename]
    );
    return mapJobRow(result.rows[0]);
  },

  async findById(id: string): Promise<Job | null> {
    const result = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [id]);
    if (result.rowCount === 0) return null;
    return mapJobRow(result.rows[0]);
  },

  async list(): Promise<Job[]> {
    const result = await pool.query(`SELECT * FROM jobs ORDER BY created_at DESC`);
    return result.rows.map(mapJobRow);
  },

  async updateProgress(options: {
    id: string;
    status?: JobStatus;
    totalRows?: number;
    processedRows?: number;
    successCount?: number;
    failedCount?: number;
    errors?: JobError[];
    completedAt?: Date | null;
  }): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (options.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(options.status);
    }
    if (options.totalRows !== undefined) {
      fields.push(`total_rows = $${idx++}`);
      values.push(options.totalRows);
    }
    if (options.processedRows !== undefined) {
      fields.push(`processed_rows = $${idx++}`);
      values.push(options.processedRows);
    }
    if (options.successCount !== undefined) {
      fields.push(`success_count = $${idx++}`);
      values.push(options.successCount);
    }
    if (options.failedCount !== undefined) {
      fields.push(`failed_count = $${idx++}`);
      values.push(options.failedCount);
    }
    if (options.errors !== undefined) {
      fields.push(`errors = $${idx++}`);
      values.push(JSON.stringify(options.errors));
    }
    if (options.completedAt !== undefined) {
      fields.push(`completed_at = $${idx++}`);
      values.push(options.completedAt);
    }

    if (!fields.length) return;

    const query = `UPDATE jobs SET ${fields.join(', ')} WHERE id = $${idx}`;
    values.push(options.id);
    await pool.query(query, values);
  }
};
