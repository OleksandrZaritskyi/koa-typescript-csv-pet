/**
 * Initial schema migration
 * Creates jobs and customers tables
 * @type {import('node-pg-migrate').MigrationBuilder}
 */

exports.up = (pgm) => {
  // Enable pgcrypto extension for UUID generation
  pgm.createExtension('pgcrypto', { ifNotExists: true });

  // Create jobs table
  pgm.createTable('jobs', {
    id: {
      type: 'uuid',
      primaryKey: true,
    },
    filename: {
      type: 'text',
      notNull: true,
    },
    status: {
      type: 'text',
      notNull: true,
      check: "status IN ('pending', 'processing', 'completed', 'failed')",
    },
    total_rows: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    processed_rows: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    success_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    failed_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    errors: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'[]'::jsonb"),
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    completed_at: {
      type: 'timestamptz',
    },
  });

  // Create customers table
  pgm.createTable('customers', {
    id: {
      type: 'uuid',
      primaryKey: true,
    },
    job_id: {
      type: 'uuid',
      references: 'jobs',
    },
    name: {
      type: 'text',
      notNull: true,
    },
    email: {
      type: 'text',
      notNull: true,
      unique: true,
    },
    phone: {
      type: 'text',
    },
    company: {
      type: 'text',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  // Add index on customers.job_id for faster lookups
  pgm.createIndex('customers', 'job_id');
};

exports.down = (pgm) => {
  pgm.dropTable('customers');
  pgm.dropTable('jobs');
  pgm.dropExtension('pgcrypto');
};
