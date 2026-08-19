<div align="center">

<img src="docs/images/banner.svg" alt="ClinicFlow — Multi-tenant Clinic Scheduling Platform" width="100%" />

### Multi-tenant clinic scheduling platform with paid reservations, real-time availability, and delegated authentication.

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![Jest](https://img.shields.io/badge/Jest-C21325?style=flat&logo=jest&logoColor=white)](https://jestjs.io/)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=flat&logo=socket.io&logoColor=white)](https://socket.io/)
[![Stripe](https://img.shields.io/badge/Stripe-635BFF?style=flat&logo=stripe&logoColor=white)](https://stripe.com/)
[![Render](https://img.shields.io/badge/Render-46E3B7?style=flat&logo=render&logoColor=white)](https://render.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat)](LICENSE)

**[Live app](https://horizonte-saude-api.onrender.com)** · **[API docs](#api)** · **[Architecture](docs/architecture.md)** · **[Deployment](docs/deployment.md)**

</div>

---

## Overview

ClinicFlow is a backend platform for clinics that need online scheduling with a real payment
guarantee: a patient picks a specialty, a professional and a date, and reserving that slot
requires paying online to hold it. Payment confirmation is asynchronous (Stripe webhook,
idempotent), the slot updates in real time for anyone else looking at the same professional, and a
confirmation email goes out automatically — all served from one deployment that hosts **multiple
independent clinics**, each fully isolated from the others.

It started as a single-tenant academic MVP (static HTML + local JSON storage) and was rebuilt,
phase by phase, into the production system described below: TypeScript, Prisma/PostgreSQL,
authentication delegated to an external identity service, Stripe payments, Socket.io, structured
observability, and a real deploy on Render.

> ⚠️ **Portfolio project.** This is a fully working system, not a mockup — but the free-tier hosting
> means the API may take 30-60s to respond on the first request after a period of inactivity
> (cold start). See [Deployment](#deployment) for the trade-offs of running on free infrastructure.

## Why this project?

- **Layered architecture** (routes → controllers → services → repositories) with a clear
  single-responsibility boundary at each layer — not a folder-per-file-type exercise, an actual
  dependency direction that's enforced in practice.
- **Real multi-tenancy**, not a `tenant_id` bolted on as an afterthought — every repository method
  requires a `clinicaId`, so tenant isolation is a structural guarantee, checked by the compiler,
  not a convention someone can forget.
- **Delegated identity** via [AccessCore](https://github.com/lucafurtado/accesscore), an external
  RBAC/identity service — this project never stores a password or decodes a JWT itself.
- **A real payment integration**, including the asynchronous parts that are easy to get wrong:
  webhook signature verification, idempotent event handling, and releasing a reservation when
  payment fails instead of leaving it stuck.
- **Real-time state**, scoped correctly — Socket.io rooms per clinic _and_ professional, not a
  global broadcast.
- **Dockerized from day one**, with a docker-compose environment that mirrors production closely
  enough to catch real bugs before they reach it (two of the three bugs fixed for this release were
  caught exactly this way).
- **Deployed to a real, persistent production environment** — not just "it works on my machine":
  see [Deployment](#deployment) for the two production build bugs that were only visible under an
  actual `NODE_ENV=production` install, and how they were found and fixed.
- **Automated tests that test behavior, not implementation** — Jest + Supertest against a real
  Postgres instance, with only genuinely external services (AccessCore, Stripe, email) mocked.
- **Built for a real environment**, with the operational concerns that come with one: structured
  logging, a health check backed by a real database ping, graceful shutdown, and security headers.

## Highlights

|                                   |                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| 🏗️ **Clean Architecture**         | Strict layering, dependency direction enforced by import discipline                         |
| 🗄️ **Repository Pattern**         | Prisma is only ever touched by the repository layer                                         |
| 🔐 **RBAC**                       | Permission-based route guards, resolved live against the identity provider on every request |
| 🏢 **Multi-tenant**               | Tenant isolation enforced at the data-access layer, not just by convention                  |
| 🔌 **WebSockets**                 | Socket.io, rooms scoped per clinic + professional                                           |
| 💳 **Payment Integration**        | Stripe Checkout + signed, idempotent webhooks                                               |
| 🪪 **External Identity Provider** | Auth/RBAC delegated to AccessCore — zero password handling in this codebase                 |
| 🐳 **Docker**                     | `docker compose up` and you have the full stack, database included                          |
| 📊 **Observability**              | Structured JSON logging (pino), `/health` backed by a real DB check                         |
| 🚀 **Production deploy**          | Live on Render — not just documented, actually running                                      |

## Features

✅ Multi-tenant clinic isolation
✅ RBAC (permission-based route guards)
✅ Delegated authentication (external identity provider)
✅ Prisma ORM with versioned migrations
✅ PostgreSQL with race-condition-closing constraints
✅ Stripe Checkout integration
✅ Stripe Webhooks (signed, idempotent)
✅ Socket.io real-time availability updates
✅ Docker & Docker Compose
✅ Automated tests (Jest + Supertest, real database)
✅ Health check endpoint
✅ Structured logging (pino)
✅ Production ready (deployed, hardened, documented)

## Architecture

```mermaid
flowchart TB
    subgraph Client
        Browser["Browser (static HTML/JS)"]
    end

    subgraph "ClinicFlow API (Node/Express)"
        API["routes → controllers → services → repositories"]
        Socket["Socket.io"]
    end

    subgraph External
        AccessCore["AccessCore\n(identity, separate service)"]
        Stripe["Stripe Checkout\n(sandbox)"]
        SMTP["SMTP\n(Resend / Ethereal)"]
    end

    DB[("PostgreSQL")]

    Browser -- "REST + WebSocket" --> API
    Browser <-. "datas:atualizadas" .-> Socket
    API --> DB
    API -- "login / validate token" --> AccessCore
    API -- "create checkout session" --> Stripe
    Stripe -- "signed webhook" --> API
    API -- "confirmation / cancellation" --> SMTP
    API --> Socket
```

A `resolveClinica` middleware resolves `:clinicaSlug` at the top of every business route and
populates `req.clinica` — nothing downstream needs to know multi-tenancy exists, it just receives
an already-validated `clinicaId` (404 upfront if the slug doesn't exist).

Full write-up, including the authentication sequence diagram and the ER diagram of the data model:
**[docs/architecture.md](docs/architecture.md)** and **[docs/system-overview.md](docs/system-overview.md)**.

## Folder Structure

```
src/
├── app.ts, server.ts        # Express + Socket.io bootstrap, graceful shutdown
├── controllers/               # HTTP ↔ domain translation
├── services/                  # business rules + external integrations
├── repositories/              # the only layer that talks to Prisma
├── routes/                    # method + path → controller wiring
├── middleware/                 # auth (AccessCore), resolveClinica (tenant), errorHandler
├── schemas/                    # Zod validation, one file per domain
├── realtime/socket.ts           # Socket.io rooms
└── lib/                         # Prisma client singleton, pino logger

prisma/            # schema, migrations, seed (compiled separately for production)
tests/              # Jest + Supertest, real Postgres, external services mocked
docs/                # architecture, system overview, deployment
scripts/              # one-off operational scripts (AccessCore bootstrap)
```

## Tech Stack

| Layer         | Choice                                                                               | Why                                                                                                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language      | TypeScript                                                                           | End-to-end typing from the schema (Prisma) through services to controllers — most "wrong field" bugs become compile errors, not runtime ones.                                                               |
| Web framework | Express 5                                                                            | Native `async` handler support — errors thrown in a promise reach `errorHandler` without a manual `try/catch` in every route.                                                                               |
| ORM           | Prisma 7 (`@prisma/adapter-pg`)                                                      | Versioned migrations, a fully-typed client generated from the schema, and the `pg` adapter avoids Prisma's older Rust query engine.                                                                         |
| Database      | PostgreSQL 16                                                                        | Composite unique constraints (`profissionalId+dataConsulta`, `clinicaId+cpf`) let the database itself close race conditions the application code alone wouldn't reliably close.                             |
| Identity      | AccessCore (external service, [own repo](https://github.com/lucafurtado/accesscore)) | Login, RBAC and token issuance/validation aren't this project's domain — delegating avoids reimplementing authentication (and its security bugs) a second time.                                             |
| Payments      | Stripe Checkout (sandbox mode)                                                       | Checkout is hosted by Stripe — no card data ever touches this backend.                                                                                                                                      |
| Real-time     | Socket.io                                                                            | Automatic long-polling fallback when WebSocket isn't available (corporate proxies, etc.), no extra code required.                                                                                           |
| Email         | Nodemailer + Ethereal (dev) / Resend (production)                                    | Nodemailer is provider-agnostic — switching from Ethereal to Resend is configuration only, no code change.                                                                                                  |
| Logging       | pino / pino-http                                                                     | Structured JSON in production (ready for any log aggregator), pretty-printed in development.                                                                                                                |
| Testing       | Jest + Supertest, `ts-jest`                                                          | Real integration tests against Postgres (no database mocking) — only AccessCore/Stripe/email are mocked, because they're genuinely external.                                                                |
| Deployment    | Render (Web Service + PostgreSQL)                                                    | A persistent Node process — required for Socket.io's WebSocket connections, which don't survive a traditional serverless model (why the original `vercel.json` was removed; see [Deployment](#deployment)). |

## Running Locally

Prerequisites: Node 22+, a reachable PostgreSQL instance (e.g. `docker compose up db` for just the
database).

```bash
npm install
cp .env.example .env          # adjust DATABASE_URL etc.
npm run prisma:migrate        # apply migrations
npm run prisma:seed           # seed two example clinics
npm run dev                   # tsx watch — http://localhost:3000
```

## Docker

```bash
docker compose up --build -V   # -V forces recreating the node_modules anonymous volume
docker compose exec app npx prisma migrate deploy   # first run only (empty database)
docker compose exec app npx prisma db seed
```

App at `http://localhost:3000`, Postgres exposed on `localhost:5434` (so you can run
`npm test`/Prisma Studio from the host while the database lives in the container).
`docker compose down -v` tears everything down, including the data.

## Environment Variables

Copy `.env.example` to `.env`. Full reference (every variable is also commented in that file):

| Variable                                                                            | Required                 | Description                                                                                        |
| ----------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------- |
| `PORT`                                                                              | no (default `3000`)      | HTTP port.                                                                                         |
| `NODE_ENV`                                                                          | no                       | `production` enables pure JSON logging and the `Secure` attribute on the refresh cookie.           |
| `LOG_LEVEL`                                                                         | no (default `info`)      | Minimum pino log level.                                                                            |
| `DATABASE_URL`                                                                      | **yes**                  | PostgreSQL connection string.                                                                      |
| `ALLOWED_ORIGINS`                                                                   | no                       | Comma-separated allowed CORS origins. Empty = closed (frontend and backend are same-origin today). |
| `ACCESSCORE_URL`                                                                    | **yes**                  | Base URL (with `/api/v1`) of the AccessCore instance.                                              |
| `ACCESSCORE_ADMIN_EMAIL` / `ACCESSCORE_ADMIN_PASSWORD`                              | no                       | Only for `scripts/bootstrap-accesscore.ts`, never read at runtime.                                 |
| `APP_BASE_URL`                                                                      | **yes**                  | This app's public URL, used to build the Stripe Checkout return links.                             |
| `STRIPE_SECRET_KEY`                                                                 | yes, for payments        | Stripe secret key (`sk_test_...`).                                                                 |
| `STRIPE_WEBHOOK_SECRET`                                                             | yes, to confirm payments | Webhook signing secret (`whsec_...`).                                                              |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | no                       | Without `SMTP_HOST`, falls back to an Ethereal test account (dev/test only).                       |

The app boots and serves every non-payment/non-email route without the optional variables above —
this repo never ships with fake/placeholder credentials to fake a "complete" configuration.

## API

All routes below (except `/health` and `/webhooks/stripe`) live under `/clinicas/:clinicaSlug`.

### Public

| Method | Route                      | Description                                             |
| ------ | -------------------------- | ------------------------------------------------------- |
| GET    | `/health`                  | Health check (verifies database connectivity)           |
| GET    | `/especialidades`          | Distinct specialties for the clinic                     |
| GET    | `/profissionais`           | Professionals (optional `?especialidade=` filter)       |
| GET    | `/profissionais/:id/datas` | Available dates for a professional                      |
| POST   | `/agendamentos`            | Creates a reservation + Stripe checkout session         |
| GET    | `/agendamentos/:cpf`       | Looks up bookings by CPF                                |
| DELETE | `/agendamentos/:id`        | Cancels a booking (patient, requires `cpf` in the body) |
| POST   | `/webhooks/stripe`         | Stripe webhook                                          |

### Authenticated (AccessCore)

| Method | Route                                          | Description                                     |
| ------ | ---------------------------------------------- | ----------------------------------------------- |
| POST   | `/auth/login`, `/auth/refresh`, `/auth/logout` | Authentication via AccessCore                   |
| POST   | `/admin/profissionais`                         | Creates a professional (`profissionais:manage`) |
| DELETE | `/admin/agendamentos/:id`                      | Cancels as staff (`agendamentos:manage`)        |

### Payments

Full reserve → checkout → webhook → confirm flow, plus how to configure Stripe test credentials
and validate webhooks with the Stripe CLI:

1. Create a Stripe account and grab a **test** secret key at
   [dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys) (`sk_test_...`).
   Sandbox mode — no real charge.
2. Set `STRIPE_SECRET_KEY` and `APP_BASE_URL` (see [Environment Variables](#environment-variables)).
3. Without `STRIPE_WEBHOOK_SECRET`, checkout is created normally but confirmation (which depends
   on the webhook) never happens:
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/webhooks/stripe
   # copy the printed whsec_... into STRIPE_WEBHOOK_SECRET, restart the app
   stripe trigger checkout.session.completed
   # or: make a real reservation, pay at the returned checkoutUrl with 4242 4242 4242 4242
   stripe trigger checkout.session.expired   # simulates an incomplete payment
   ```

**Without `STRIPE_SECRET_KEY`** (this repo's default state — no fake key is used), creating a
reservation fails with a controlled `500` and the slot is **not** left locked — see
[docs/architecture.md](docs/architecture.md) for why, and how that failure mode was found and
fixed. This is the behavior validated both locally and in the production deploy.

### Real-time

Each client joins a `clinica:<slug>:profissional:<id>` room when selecting a professional
(`src/realtime/socket.ts`). Reserving, confirming payment, cancelling, or a reservation expiring
all emit `datas:atualizadas` only to clients in that specific room — not a global broadcast — which
keeps the same tenant isolation guarantee in real time.

### Email

`src/services/emailService.ts`: without `SMTP_HOST`, an [Ethereal](https://ethereal.email/) test
account is created automatically — no real email is sent, but the whole flow still runs end to end
and a preview URL is logged. A send failure never breaks the flow that triggered it (a
reservation/cancellation stays valid even if the email fails) — it's only logged. In production,
configure `SMTP_*` for a real provider (Resend recommended).

## Testing

```bash
npm test               # full suite (Jest + Supertest)
npm run typecheck        # tsc --noEmit
npm run lint              # eslint .
npm run format:check      # prettier --check .
```

AccessCore, Stripe and the email provider are mocked at the boundary (`tests/jest.setup.ts` and the
`jest.mock(...)` calls at the top of each test file) — the suite depends on no external service and
no credentials. Everything else (database, business rules, multi-tenant isolation, RBAC) runs end
to end against a real Postgres instance.

Requires a Postgres reachable on port `5434` (local, or via `docker compose up db`):

```bash
docker compose exec db psql -U horizonte -d horizonte_saude -c "CREATE DATABASE horizonte_saude_test;"
DATABASE_URL="postgresql://horizonte:horizonte@localhost:5434/horizonte_saude_test" npx prisma migrate deploy
```

`jest` runs with `maxWorkers: 1`: the three test files share the same physical database and each
resets its own tables between cases — running in parallel (Jest's default) causes foreign-key
violations between concurrent suites.

`npx jest --coverage` produces a coverage report (~85% statements/lines overall). The lower spots
are deliberate, not gaps: `src/realtime/socket.ts` (a real WebSocket handshake is out of scope for
an HTTP test via Supertest) and `src/services/accessCoreClient.ts` (a thin HTTP client — what
matters is testing the behavior of its callers, already covered via mocks in `tests/admin.test.ts`).

## Deployment

Currently deployed on **Render** — a Web Service (Node, free plan) + PostgreSQL (free plan, same
region). Not Vercel (the platform used for the pre-rewrite MVP, see the removed `vercel.json`):
Vercel's serverless model doesn't sustain the persistent WebSocket connections Socket.io needs — a
continuously-running Node process, like Render's, is required for real-time to actually work in
production, not just locally.

This repo includes a [render.yaml](render.yaml) Blueprint matching the production configuration.
Full deployment guide, including the exact steps used for the first real deploy (and the two
production-only build bugs found and fixed along the way): **[docs/deployment.md](docs/deployment.md)**.

**Free tier note:** Render's free Postgres expires 30 days after creation (recreate it, or upgrade,
before then); the free Web Service sleeps after 15 minutes without traffic — the same trade-off
already accepted by the AccessCore identity service this project depends on.

## Future Improvements

Known, deliberate scope boundaries for this release — not bugs:

- **Clinic membership invite flow.** Today, linking an AccessCore user to a clinic (`Membro` table)
  is done via direct database access — there's no `POST /admin/membros` route. Reasonable for a
  single clinic (or a portfolio demo); an email-based invite flow would be the natural next step
  for several clinics self-managing their own staff.
- **CSP with nonces.** Would require moving the inline `<script>` in `index.html` to an external
  file — see [docs/architecture.md](docs/architecture.md).
- **Orphaned-reservation cleanup job**, for the rare case where Stripe becomes unreachable exactly
  between creating the reservation and creating the checkout session — that specific case no
  longer locks the slot (see [CHANGELOG.md](CHANGELOG.md)), but a periodic job would be an extra
  safety net.
- **Frontend as a separate application** (today it's static HTML/CSS/JS served by Express itself)
  — a prerequisite, along with the CSP work, for a richer UI without touching the backend.
- **Payment history after cancellation.** Cancelling an already-paid booking also removes the
  `Pagamento` record (cascade) — keeping history would require soft-deleting `Agendamento` instead.
- **CI pipeline** (GitHub Actions) running typecheck/lint/test on every PR — validation today is
  run manually before each release.

## License

[MIT](LICENSE) — see the license file for details.
