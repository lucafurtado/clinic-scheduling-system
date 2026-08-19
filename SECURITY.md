# Security Policy

## Reporting a vulnerability

If you find a security issue in this project, please **do not open a public issue**. Instead,
report it privately via [GitHub Security Advisories](https://github.com/lucafurtado/clinic-scheduling-system/security/advisories/new)
for this repository, or by contacting the maintainer directly.

Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce (or a proof of concept)
- Any suggested fix, if you have one

You should get an initial response within a few days.

## Supported versions

This project follows a single `main` branch — only the latest release is supported.

## Security measures already in place

- **Secrets never committed.** All credentials (database, Stripe, SMTP, AccessCore) are read from
  environment variables (`.env`, gitignored); `.env.example` documents every variable without real
  values. No fake/placeholder keys are used to fake a "working" configuration.
- **Payments in sandbox mode.** Stripe integration runs against test-mode keys; no real charges are
  processed by this codebase.
- **Webhook signature verification.** The Stripe webhook endpoint (`POST /webhooks/stripe`)
  validates the `Stripe-Signature` header against `STRIPE_WEBHOOK_SECRET` using the raw request
  body — requests with an invalid or missing signature are rejected before any data is touched.
- **No local password/token handling.** Authentication is delegated entirely to an external
  identity provider (AccessCore); this codebase never stores or validates a password.
- **Multi-tenant isolation.** Every query is scoped by `clinicaId`; a user or record from one
  tenant can never be resolved through another tenant's routes, even if the numeric ID is known.
- **Security headers** via [Helmet](https://helmetjs.github.io/) and rate limiting on the public
  booking endpoint (`express-rate-limit`).
- **Dependency auditing.** `npm audit` is checked as part of the release process; known,
  non-exploitable transitive advisories are documented rather than silently ignored (see
  [CHANGELOG.md](CHANGELOG.md)).
