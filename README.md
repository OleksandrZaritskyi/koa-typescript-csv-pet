# Real-Time CSV Processing System

Backend-first CSV ingestion service with live progress updates, SSE streaming, Redis-backed job queue, and a minimal MUI dashboard.

## Prerequisites
- Docker + Docker Compose
- Node 20+ (only if running without Docker)

## Quickstart

```bash
# Dev (hot reload)
npm run dev

# Dev with rebuild
npm run dev:build

# Prod
npm run prod

# Prod with rebuild
npm run prod:build
```

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev environment (hot reload) |
| `npm run dev:build` | Start dev with `--build` flag |
| `npm run prod` | Start production environment |
| `npm run prod:build` | Start production with `--build` flag |
| `npm run logs` | Tail logs for all services |
| `npm run logs:api` | Tail logs for API only |
| `npm run logs:web` | Tail logs for Web only |
| `npm run db` | Open psql shell to database |
| `npm run migrate` | Run pending migrations |
| `npm run migrate:down` | Rollback last migration |
| `npm run migrate:create -- <name>` | Create new migration |

## Services

### Dev Mode
| Service | URL |
|---------|-----|
| Web (Vite) | http://localhost:5173 |
| API | http://localhost:4000 |
| pgAdmin | http://localhost:8080 |
| Postgres | localhost:5432 |
| Redis | localhost:6379 |

### Prod Mode
| Service | URL |
|---------|-----|
| Web (nginx) | http://localhost:3000 |
| API | http://localhost:4000 |

## pgAdmin (Database UI)

1. Open http://localhost:8080
2. Login: `admin@admin.com` / `admin`
3. Add server:
   - Name: `csv_app`
   - Host: `postgres`
   - Port: `5432`
   - Database: `csv_app`
   - Username: `postgres`
   - Password: `postgres`

## Environment
Copy `.env.example` to `.env` (used by containers).

Key vars:
| Variable | Default | Description |
|----------|---------|-------------|
| `API_HOST` | `0.0.0.0` | API listen host |
| `API_PORT` | `4000` | API listen port |
| `DB_HOST` | `postgres` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |
| `DB_NAME` | `csv_app` | Database name |
| `REDIS_HOST` | `redis` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `CORS_ORIGIN` | `*` | Allowed CORS origin |
| `UPLOAD_DIR` | `/app/uploads` | CSV upload directory |
| `VITE_API_BASE` | `http://localhost:4000/api` | Frontend API URL |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/jobs/upload` | Upload CSV (multipart, field: `file`) → `{ jobId }` |
| GET | `/api/jobs` | List all jobs (desc by createdAt) |
| GET | `/api/jobs/:id` | Get job details |
| GET | `/api/jobs/:id/stream` | SSE progress stream |
| GET | `/api/jobs/:id/errors.csv` | Download error report CSV |

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│   Koa API   │────▶│    Redis    │
│   (React)   │     │             │     │   (Queue)   │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                   │
                    ┌──────▼──────┐     ┌──────▼──────┐
                    │  PostgreSQL │◀────│ Bull Worker │
                    │   (Data)    │     │(concurrency=1)
                    └─────────────┘     └─────────────┘
```

## Queue & Worker (Bonus 2 + 4)

**Redis + Bull Queue** (production-ready):
- Jobs persisted in Redis — survives server restarts
- Single worker with `concurrency=1` — processes one job at a time, FIFO order
- Worker starts automatically on server boot
- Built-in retry support (disabled by default)

```typescript
// Producer (jobService.ts)
await csvQueue.add({ jobId });

// Consumer (worker.ts)
csvQueue.process(1, async (job) => {
  await processJob(job.data.jobId);
});
```

## Live Updates / SSE (Bonus 1)

- Endpoint: `GET /api/jobs/:id/stream`
- Content-Type: `text/event-stream`
- Pushes progress events:
  ```json
  { "jobId": "...", "processedRows": 5, "totalRows": 10, "successCount": 4, "failedCount": 1, "status": "processing" }
  ```
- Stream closes automatically when job completes or fails
- Frontend auto-subscribes for active jobs (pending/processing)

## Error Report CSV (Bonus 3)

- Endpoint: `GET /api/jobs/:id/errors.csv`
- Downloads CSV with columns: `rowNumber,name,email,phone,company,error`
- Frontend has "Download Error Report" button in expanded job view

## CSV Processing Rules

**Columns**: `name`, `email`, `phone`, `company`

**Validation**:
| Field | Rule |
|-------|------|
| `name` | Required, non-empty |
| `email` | Required, valid format, unique in DB |
| `phone` | Optional |
| `company` | Required, non-empty |

**Error handling**: Invalid rows increment `failedCount`; errors stored as `{ rowNumber, message, row }`

**Performance**: Batch inserts (100 rows per INSERT), SSE throttling (300ms), event loop yielding

**Status flow**: `pending` → `processing` → `completed` (or `failed` on fatal error)

## Database Schema

See [api/migrations/](api/migrations/) for schema definition.

**jobs table**:
- `id` (uuid, PK)
- `filename`, `status`, `total_rows`, `processed_rows`, `success_count`, `failed_count`
- `errors` (jsonb array)
- `created_at`, `completed_at`

**customers table**:
- `id` (uuid, PK)
- `job_id` (FK → jobs)
- `name`, `email` (unique), `phone`, `company`
- `created_at`

## Database Migrations

Uses [node-pg-migrate](https://github.com/salsita/node-pg-migrate) for schema versioning.

**Migrations run automatically** on container startup (both dev and prod).

### Manual Commands

```bash
# Run pending migrations (via Docker)
npm run migrate

# Rollback last migration
npm run migrate:down

# Create new migration
npm run migrate:create -- add-new-column
```

### Migration Files

Located in `api/migrations/`. Use `.cjs` extension (CommonJS) for compatibility.

```javascript
// Example: api/migrations/1737312000000_add-column.cjs
exports.up = (pgm) => {
  pgm.addColumn('customers', {
    notes: { type: 'text' }
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('customers', 'notes');
};
```

## Frontend

- **Stack**: React 18 + TypeScript + Material UI + Vite
- **Features**:
  - Upload form with status message
  - Jobs table with progress, status chip, expandable errors
  - SSE live updates for active jobs
  - Manual Refresh button
  - Download Error Report button

## Bonus Coverage

| Bonus | Description | Status |
|-------|-------------|--------|
| 1 | SSE live progress updates | ✅ |
| 2 | FIFO job queue + single worker | ✅ |
| 3 | Downloadable error report CSV | ✅ |
| 4 | Redis + Bull queue (production-ready) | ✅ |

## Tech Stack

**Backend**:
- Koa 3 + TypeScript
- Bull (Redis-backed job queue)
- node-postgres (pg)
- node-pg-migrate (schema migrations)
- csv-parser (streaming)
- zod (validation)

**Frontend**:
- React 18 + TypeScript
- Material UI 5
- Vite 5

**Infrastructure**:
- PostgreSQL 15
- Redis 7
- Docker Compose
- nginx (prod)

## Running without Docker (dev)

```bash
# Terminal 1 - Start Postgres
docker run -d --name postgres -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=csv_app \
  postgres:15

# Terminal 2 - Start Redis
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Terminal 3 - API (install, migrate, run)
cd api && npm install && npm run migrate:up && npm run dev

# Terminal 4 - Web
cd web && npm install && npm run dev
```

## Assumptions & Limitations

- Uploads stored on local disk (`UPLOAD_DIR`)
- No authentication; CORS wide open for demo
- Single worker instance (horizontal scaling possible with Bull but not configured)