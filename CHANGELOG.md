# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project
follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Rebranded the project to **ClinicFlow**. This is a documentation/presentation change only —
  no public endpoints, database schema, or business logic changed. The demo tenant seeded in the
  database (`Clínica Horizonte Saúde`, slug `horizonte-saude`) was intentionally left unchanged:
  it's example customer data for the multi-tenant demo, not product branding, and its slug is part
  of the live production URL path.
- Added `LICENSE` (MIT), `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`, GitHub issue/PR
  templates, and a `docs/` folder (`architecture.md`, `system-overview.md`, `deployment.md`).
- `package.json` now declares `name`, `version`, `description`, `license`, `repository` and
  `keywords` — previously absent.

## [1.0.0] — 2026-08-19

First tagged release. Marks the transition from a single-tenant academic MVP to a multi-tenant,
production-deployed scheduling platform.

### Added

- Multi-tenant data model and routing (`/clinicas/:slug/...`), with tenant isolation enforced at
  the repository layer, not just by convention.
- Layered architecture: routes → controllers → services → repositories → Prisma → PostgreSQL.
- Authentication and RBAC delegated to an external identity provider (AccessCore) — login,
  refresh, permission-based route guards, clinic membership checks.
- Reservation + payment flow via Stripe Checkout (sandbox), with idempotent webhook-driven
  confirmation and automatic slot release on payment expiration/failure.
- Real-time availability updates via Socket.io, scoped per clinic + professional.
- Transactional email (booking confirmation/cancellation) via Nodemailer, with an automatic
  Ethereal fallback in development.
- Structured logging (pino/pino-http), a `/health` endpoint backed by a real database check, and
  production hardening (Helmet, `trust proxy`, graceful shutdown on `SIGTERM`/`SIGINT`).
- Automated test suite (Jest + Supertest) covering the business logic end-to-end against a real
  Postgres instance, with AccessCore/Stripe/email mocked at the boundary — 28 tests, ~85%
  statement coverage.
- Docker Compose environment for local development (app + Postgres).
- Production deployment on Render (Web Service + managed PostgreSQL).

### Fixed

- A reservation could stay stuck in `PENDENTE_PAGAMENTO`, permanently occupying its slot, if
  Stripe checkout-session creation failed (e.g. missing/invalid key, Stripe outage). The
  reservation is now rolled back and the slot released immediately on that failure path.
- The production build failed the first time it ran on a real hosting platform: Render installs
  only `dependencies` (not `devDependencies`) once `NODE_ENV=production`, but the build needed
  `typescript` and several `@types/*` packages that were only declared as devDependencies. Moved
  the packages the build genuinely needs to `dependencies`; kept test-only tooling in
  `devDependencies`.
- The database seed script depended on `tsx` (a devDependency) to run against production. It's
  now compiled ahead of time (`prisma/tsconfig.seed.json` → `dist/prisma/seed.js`) instead of
  requiring a TypeScript runtime in production.

### Removed

- `vercel.json`, left over from the pre-rewrite MVP — targeted Vercel serverless functions, which
  don't sustain the persistent WebSocket connections Socket.io needs.
- `data.json`, leftover local-storage data from the original MVP (unreferenced by any code).
- Unused direct dependencies `pg` / `@types/pg` (still available transitively via
  `@prisma/adapter-pg`, which already declares them).

### Known limitations

See [README → Future Improvements](README.md#future-improvements) for the full list (no
self-service clinic-membership invite flow, CSP disabled pending a frontend rewrite, free-tier
hosting constraints, etc.) — these are deliberate scope boundaries for this release, not bugs.
