# Response Hub API

Backend for the Response Hub emergency incident platform: Node.js 22, Express 5, TypeScript, Prisma 6, PostgreSQL + PostGIS, Socket.io, S3-compatible object storage, JWT auth with role-based access.

## Quick start (local)

Requires Node 22+ and Docker (for PostGIS and MinIO). Any PostgreSQL 14+ with PostGIS 3 works instead of Docker.

```bash
cd server
cp .env.example .env                 # then set JWT_SECRET and SEED_ADMIN_PASSWORD
npm install
npm run db:up                        # PostGIS on :5432
docker compose up -d minio           # S3-compatible storage on :9000 (console :9001)
npm run db:deploy                    # apply migrations (creates the postgis extension)
npm run db:generate                  # generate the Prisma client
npm run db:seed                      # first admin + demo incidents
npm run dev                          # http://localhost:4000
```

Create the `responsehub-media` bucket in the MinIO console (http://localhost:9001, minioadmin/minioadmin) and allow CORS `POST` from the Vite origin. For R2, S3 or Supabase, set the `S3_*` variables and add a bucket CORS rule that allows `POST` from your frontend origin.

Frontend: set `VITE_API_URL=http://localhost:4000` in the root `.env`, and run `pnpm add socket.io-client` before importing `src/services/realtime.ts`.

### Migrations

| Command | When |
| --- | --- |
| `npm run db:migrate -- --name <change>` | Development: edit `schema.prisma`, generate and apply a new migration |
| `npm run db:deploy` | CI / production: apply pending migrations only |

`20261110000100_postgis_location` adds the trigger that derives the `location geography(Point,4326)` column from `latitude`/`longitude`, plus coordinate CHECK constraints and a partial GiST index for active incidents. Prisma can't write `Unsupported` columns, so the app writes only lat/lng and PostGIS keeps `location` in sync, including for seeds and manual SQL.

The database user running migrations needs permission to `CREATE EXTENSION postgis`. On managed Postgres (RDS, Supabase, Neon) enable PostGIS from the provider console first if needed.

## Layout

```
server/
├── docker-compose.yml          PostGIS 16 + MinIO
├── .env.example
├── prisma/
│   ├── schema.prisma           models, enums, GiST index
│   ├── migrations/             init + PostGIS trigger
│   └── seed.ts                 admin + demo data (reuses ../src/data/seedIncidents.ts)
└── src/
    ├── index.ts                HTTP + Socket.io bootstrap, graceful shutdown
    ├── app.ts                  Express app: helmet, CORS, JSON limit, logging, health checks
    ├── config/env.ts           zod-validated environment (fails fast)
    ├── domain/
    │   ├── contract.ts         wire types (mirrored in ../src/types/api.ts)
    │   ├── enums.ts            DB enum ↔ frontend label maps
    │   ├── mapper.ts           Prisma rows → DTOs (full / public redacted)
    │   ├── severity.ts         server-side port of utils/severity.ts
    │   └── trackingCode.ts     RH-YYYY-XXXXXXXX generator
    ├── schemas/                zod request schemas
    ├── middleware/             auth (JWT + RBAC), rate limits, error handler
    ├── services/
    │   ├── incident.service.ts report, track, list, row-locked mutations + audit log
    │   ├── geo.service.ts      PostGIS nearby + hotspot clustering
    │   ├── analytics.service.ts
    │   └── auth.service.ts
    ├── controllers/            HTTP adapters (parse → service → respond)
    ├── routes/index.ts         route table + permission matrix
    ├── realtime/
    │   ├── events.ts           in-process domain event bus
    │   └── socket.ts           Socket.io rooms & auth
    └── lib/                    prisma, logger, storage (S3 presign), errors
```

## API (`/api/v1`)

All responses are `{ data: ... }` (list endpoints add `page`, `pageSize`, `total`, `totalPages`). Errors are `{ error: { code, message, details? } }`; validation failures return `422` with per-field `details`. Enum values use the frontend's display labels (`"Road Accident"`, `"In Progress"`), so responses plug straight into the existing components.

### Public

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/incidents/report` | Body = `NewIncidentInput` with `mediaKeys: string[]` in place of `photos`. Send an `Idempotency-Key` header so retries are safe. Returns `201` with `{ data: Incident, trackingCode }`. Severity is computed on the server. 20 per 15 min per IP. |
| GET | `/incidents/track/:trackingCode` | Redacted public view: no contact details, media, private notes or staff names. 120 per 15 min per IP. |
| POST | `/uploads/presigned-url` | `{ contentType, sizeBytes? }` → `{ key, url, fields, maxBytes, expiresAt }`. Presigned POST, so S3 enforces size and type. Allowed: jpeg, png, webp, heic, mp4, mov. |
| GET | `/incidents/nearby?lat=&lng=&radius=` | Active incidents within `radius` m (default 5 000, max 50 000), sorted by distance. `ST_DWithin` on a GiST index. Optional `category=Fire,Flood`, `limit`. |
| GET | `/incidents/hotspots` | `mode=grid` (default) matches `computeHotspots()` cell for cell (`cell=0.03`). `mode=density` uses `ST_ClusterDBSCAN` (`eps` meters, `minPoints`). Also `days`, `includeResolved`, `category`, `bbox=minLng,minLat,maxLng,maxLat`. Each hotspot carries `weight` (Low 1 / Med 2 / High 4 / Crit 8), `critical` and `radiusMeters`. |
| GET | `/incidents/summary` | Counters for HomePage. |

### Auth

| Method | Path | |
| --- | --- | --- |
| POST | `/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` | Current user |

### Staff (`Authorization: Bearer <jwt>`)

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/admin/incidents` | all staff. Filters: `status`, `severity`, `category`, `verification` (comma lists), `assigneeId` (`uuid`/`me`/`unassigned`), `from`, `to`, `q`, `sort` (`-createdAt`, `severity`, …), `page`, `pageSize` |
| GET | `/admin/incidents/:id` | all staff |
| PATCH | `/admin/incidents/:id/status` | all staff. `{ status, note?, notePublic? }` |
| POST | `/admin/incidents/:id/notes` | all staff. `{ message, isPublic? }` (notes are private unless `isPublic`) |
| PATCH | `/admin/incidents/:id/assignee` | all staff; responders may only assign themselves. `{ assigneeId \| null }` |
| PATCH | `/admin/incidents/:id/verification` | dispatcher/admin |
| PATCH | `/admin/incidents/:id/severity` | dispatcher/admin. `{ severity, reason }` |
| DELETE | `/admin/incidents/:id` | admin. Soft delete; the audit trail is kept |
| GET | `/admin/analytics?from=&to=` | all staff. Totals, avg/median/p90 response and resolution times, category/status/severity breakdowns, daily series, recent activity |
| GET / POST | `/admin/users` | list: all staff · create: admin |

Every mutation runs in a transaction that takes `SELECT … FOR UPDATE` on the incident row, writes an append-only `IncidentUpdate` audit entry (with structured `metadata` from/to values), and publishes a realtime event after commit.

## Realtime (Socket.io, path `/realtime`)

| Event | Room | Payload |
| --- | --- | --- |
| `incident:created` | `staff` | `{ incident }` (full) |
| `incident:updated` | `staff` | `{ incident, change }` (full) |
| `incident:updated` | `track:<code>` | `{ incident, change }` (public view; `change` is null for private updates) |
| `incident:deleted` | `staff` | `{ id }` |

Staff connect with `auth: { token }`. Citizens connect anonymously and emit `track:subscribe` `{ trackingCode }` (up to 5 per socket). A bad token is rejected; no token means public access only.

## Production notes

- **Several API instances:** add `@socket.io/redis-adapter` and replace the in-process `bus` with Redis pub/sub or a transactional outbox. Services only call `bus.emit`, so nothing else changes.
- **Proxies:** set `TRUST_PROXY` to the number of proxy hops so per-IP rate limits see real client IPs. Move the rate-limit store to Redis when running more than one instance.
- **Auth:** JWTs last one shift (`JWT_EXPIRES_IN`, default 8h), and `requireAuth` re-reads the user on every request, so deactivating an account or changing a role takes effect immediately. Refresh tokens or SSO are a natural next step.
- **Media:** buckets stay private. Responses carry 15-minute signed GET URLs unless `MEDIA_PUBLIC_BASE_URL` is set. Uploads that are never attached to a report sit under `uploads/`; add a lifecycle rule to expire them.
- **PII:** contact details appear only on staff endpoints and are redacted from logs.
