# Deployment

ClinicFlow runs in production on [Render](https://render.com) — a Web Service (persistent Node
process) + a managed PostgreSQL instance, both on the free tier.

## Why Render, not serverless

The original MVP shipped a `vercel.json` targeting Vercel serverless functions. That was removed
during the production hardening pass: Socket.io needs a long-lived process to hold WebSocket
connections open, which doesn't fit a traditional serverless request/response lifecycle. A
platform with a persistent process — Render, Railway, Fly.io, a VPS — is a hard requirement for
real-time updates to work in production the same way they work locally, not an optional nicety.

## Option A — Blueprint (recommended for a fresh deploy)

This repo includes a [render.yaml](../render.yaml) Blueprint with the same shape used in
production (Web Service + PostgreSQL, healthcheck on `/health`).

1. [dashboard.render.com](https://dashboard.render.com) → **New +** → **Blueprint** → connect this
   repository. Render detects `render.yaml` and shows the two resources it will create.
2. Fill in the variables marked `sync: false` (`APP_BASE_URL`, `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `SMTP_*`) directly in the dashboard — they're never committed to the
   repo. `APP_BASE_URL` can only be set correctly _after_ Render assigns the service's URL on
   first deploy; update it and Render redeploys automatically.
3. `npm start` (`prisma migrate deploy && node dist/server.js`) applies pending migrations on
   every deploy — there's no separate manual migration step.

## Option B — Render API directly

This is what was actually used for the first production deploy (no GitHub App "Blueprint" creation
endpoint exists in Render's public API — only management of an _existing_ blueprint). Useful if you
want scripted, reproducible provisioning:

```bash
# 1. Create the Postgres instance
curl -X POST https://api.render.com/v1/postgres \
  -H "Authorization: Bearer $RENDER_API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"clinicflow-db","plan":"free","ownerId":"<owner-id>","version":"16",
       "databaseName":"clinicflow","databaseUser":"clinicflow"}'

# 2. Create the Web Service, wiring DATABASE_URL to the DB's internal connection string
curl -X POST https://api.render.com/v1/services \
  -H "Authorization: Bearer $RENDER_API_KEY" -H "Content-Type: application/json" \
  -d '{"type":"web_service","name":"clinicflow-api","ownerId":"<owner-id>",
       "repo":"https://github.com/<you>/<repo>","branch":"main",
       "envVars":[{"key":"NODE_ENV","value":"production"},
                  {"key":"DATABASE_URL","value":"<internal-connection-string>"},
                  {"key":"ACCESSCORE_URL","value":"<your AccessCore instance>/api/v1"}],
       "serviceDetails":{"runtime":"node","plan":"free","region":"oregon",
         "envSpecificDetails":{"buildCommand":"npm install && npm run build","startCommand":"npm start"},
         "healthCheckPath":"/health"}}'
```

## Seeding a fresh production database

Render's free tier doesn't include one-off Jobs (`POST /services/:id/jobs` returns "new paid
services not allowed" on a free service), and there's no way to SSH into a free-tier instance
either. Two ways to seed:

1. **Preferred — direct connection.** If your network allows outbound TLS to the DB's external
   host (some corporate/ISP networks block this), run the compiled seed against the external
   connection string:
   ```bash
   DATABASE_URL="<external-connection-string>" node dist/prisma/seed.js
   ```
   (`npm run build` produces `dist/prisma/seed.js` — see below for why it's compiled separately.)
2. **Fallback — temporary start command.** Patch the service's start command to run the seed once,
   trigger a deploy, confirm success in the logs, then revert:
   ```bash
   # temporarily:
   "startCommand": "prisma migrate deploy && node dist/prisma/seed.js && node dist/server.js"
   # after confirming the seed ran (check deploy logs for "Seed concluído."):
   "startCommand": "prisma migrate deploy && node dist/server.js"
   ```
   `prisma/seed.ts` is idempotent — it resets and recreates the demo clinics on every run, so
   running it twice never duplicates data (verified in production before and after this project's
   release).

## Why the seed is compiled instead of run via `tsx`

`npm run build` compiles `prisma/seed.ts` to `dist/prisma/seed.js` (via
`prisma/tsconfig.seed.json`, a config separate from the main `tsconfig.json` since the script lives
outside `src/`). This exists because the very first production deploy failed in a way worth
documenting: Render installs only `dependencies` (not `devDependencies`) when `NODE_ENV=production`,
and `tsx` — needed to run `seed.ts` directly — is a devDependency. Rather than adding `tsx` (a
dev-only tool) to production dependencies, or reaching for `npx --yes tsx` (which auto-installs an
arbitrary package against a live service — flagged, correctly, by an automated safety check during
this project's own development), the seed script is compiled ahead of time like the rest of the
app.

The same devDependency-pruning behavior also broke the main build the first time (`tsc` needs
`typescript` and the `@types/*` packages the source imports) — fixed by moving those specific
packages to `dependencies`, since the build genuinely needs them, while test-only tooling (`jest`,
`ts-jest`, `@types/jest`, `eslint`, `prettier`) stayed in `devDependencies`.

## Free tier constraints

- The Postgres instance **expires 30 days after creation** on Render's free plan — recreate it (or
  upgrade) before then to avoid data loss.
- The Web Service **sleeps after 15 minutes of inactivity**; the first request after that takes
  30-60s to cold-start. This is the same trade-off already accepted for the AccessCore identity
  service this project depends on.

## Environment variables in production

See the [README's Environment Variables section](../README.md#environment-variables) for the full
reference. `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`SMTP_*` are optional at the infrastructure
level (the app boots and serves every non-payment/non-email route without them) but required for
those specific features — this project deliberately never ships with fake/placeholder credentials.
