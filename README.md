# Hotel Management Serverless API

REST API for hotel operations, built with **Express.js**, deployed on **AWS Lambda** via [Serverless Framework](https://www.serverless.com/), and backed by **MySQL**.

## Features

- **Guests** — CRUD with duplicate-email protection
- **Rooms** — inventory, status, availability by date range
- **Bookings** — create with overlap checks, status workflow, automatic room status updates
- **Health** — liveness + MySQL connectivity check

## Project layout

```
src/
  handler.js          # Lambda entry (serverless-http)
  app.js              # Express application
  local.js            # Local HTTP server
  db/pool.js          # MySQL connection pool (Lambda-friendly singleton)
  routes/             # Route definitions
  controllers/        # Business logic
  middleware/         # Validation & errors
sql/schema.sql        # Database schema
serverless.yml        # AWS Lambda + HTTP API config
```

## Prerequisites

- Node.js 18+
- MySQL 8+
- AWS credentials (for deploy)
- [Serverless Framework](https://www.serverless.com/framework/docs/getting-started) CLI

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment file and set database credentials:

   ```bash
   copy .env.example .env
   ```

3. Create tables:

   ```bash
   npm run db:init
   ```

4. Run locally:

   ```bash
   npm run dev
   ```

   API base: `http://localhost:3000`

## Deploy to AWS Lambda

1. Export DB variables (or use `.env` with a loader before deploy):

   ```bash
   set DB_HOST=your-rds-endpoint
   set DB_USER=...
   set DB_PASSWORD=...
   set DB_NAME=hotel_management
   ```

2. If MySQL is in a **VPC** (e.g. RDS), uncomment the `vpc` block in `serverless.yml` and set security group + subnet IDs.

3. Deploy:

   ```bash
   npm run deploy
   ```

   Serverless prints an **HTTP API** URL; all routes are proxied to the single Lambda function.

## API overview

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health + DB ping |
| GET/POST | `/api/guests` | List / create guests |
| GET/PUT/DELETE | `/api/guests/:id` | Guest by ID |
| GET | `/api/rooms/available?check_in=&check_out=` | Available rooms |
| GET/POST | `/api/rooms` | List / create rooms |
| GET/PUT/DELETE | `/api/rooms/:id` | Room by ID |
| GET/POST | `/api/bookings` | List / create booking |
| GET | `/api/bookings/:id` | Booking details |
| PATCH | `/api/bookings/:id/status` | Update status |
| DELETE | `/api/bookings/:id` | Cancel booking |

### Example: create booking

```json
POST /api/bookings
{
  "guest_id": "<uuid>",
  "room_id": "<uuid>",
  "check_in": "2026-12-01",
  "check_out": "2026-12-05",
  "notes": "Late arrival"
}
```

Booking `status` values: `pending`, `confirmed`, `checked_in`, `checked_out`, `cancelled`.

## Local Lambda simulation

```bash
npm run offline
```

Uses `serverless-offline` on port 3000 (see `serverless.yml`).

## Notes for production

- Use **Amazon RDS MySQL** or Aurora; place Lambda in the same VPC.
- Store secrets in **AWS Secrets Manager** or SSM Parameter Store instead of plain env vars.
- Add **API Gateway authorizers** (JWT/Cognito) for authentication.
- Enable RDS **SSL** in the pool options if required by your environment.