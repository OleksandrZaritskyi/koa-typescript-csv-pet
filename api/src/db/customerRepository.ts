import { pool } from './pool.js';

export interface CustomerInput {
  jobId: string;
  name: string;
  email: string;
  phone?: string | null;
  company: string;
}

export interface BatchInsertResult {
  successCount: number;
  errors: { index: number; message: string }[];
}

export const customerRepository = {
  async create(data: CustomerInput): Promise<void> {
    await pool.query(
      `INSERT INTO customers (id, job_id, name, email, phone, company)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
      [data.jobId, data.name, data.email, data.phone || null, data.company]
    );
  },

  async createBatch(rows: CustomerInput[]): Promise<BatchInsertResult> {
    if (rows.length === 0) return { successCount: 0, errors: [] };

    const errors: { index: number; message: string }[] = [];
    let successCount = 0;

    const values: unknown[] = [];
    const placeholders: string[] = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const offset = i * 5;
      placeholders.push(`(gen_random_uuid(), $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
      values.push(row.jobId, row.name, row.email, row.phone || null, row.company);
    }

    const query = `
      INSERT INTO customers (id, job_id, name, email, phone, company)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (email) DO NOTHING
      RETURNING email
    `;

    const result = await pool.query(query, values);
    successCount = result.rowCount || 0;

    const insertedEmails = new Set(result.rows.map((r: { email: string }) => r.email));
    for (let i = 0; i < rows.length; i++) {
      if (!insertedEmails.has(rows[i].email)) {
        errors.push({ index: i, message: 'email already exists' });
      }
    }

    return { successCount, errors };
  }
};
