import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.API_PORT || 4000),
  host: process.env.API_HOST || '0.0.0.0',
  uploadDir: process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'),
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    name: process.env.DB_NAME || 'csv_app'
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379)
  },
  corsOrigin: process.env.CORS_ORIGIN || '*'
};
