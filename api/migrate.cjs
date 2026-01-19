/**
 * Migration runner script
 * Builds DATABASE_URL from individual env vars and runs node-pg-migrate
 */

const { execSync } = require('child_process');

const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || '5432';
const user = process.env.DB_USER || 'postgres';
const password = process.env.DB_PASSWORD || 'postgres';
const database = process.env.DB_NAME || 'csv_app';

const databaseUrl = `postgres://${user}:${password}@${host}:${port}/${database}`;

const args = process.argv.slice(2).join(' ');

try {
  execSync(`node-pg-migrate ${args}`, {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });
} catch (error) {
  process.exit(1);
}
