# Contributing to ClinicFlow

Thanks for considering contributing. This is primarily a portfolio/reference project, but it's
built and tested like a real production service, so contributions are welcome.

## Getting started

```bash
npm install
cp .env.example .env          # adjust DATABASE_URL etc.
docker compose up -d db        # or point DATABASE_URL at your own Postgres
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

See the [README](README.md) for the full local/Docker setup and [docs/architecture.md](docs/architecture.md)
for how the codebase is organized.

## Before opening a PR

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
```

All four must pass. The test suite needs a reachable Postgres — see the
[Testing section](README.md#testing) of the README.

## Commit style

This repo follows [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`,
`docs:`, `chore:`, `refactor:`, `test:`). Keep commits focused — one logical change per commit.

## Pull requests

- Describe **what** changed and **why**, not just what files were touched.
- Note any breaking change explicitly (public endpoint, database schema, environment variable).
- Keep the diff scoped to the stated goal — avoid unrelated formatting/refactor noise in the same PR.

## Reporting bugs / requesting features

Use the issue templates under `.github/ISSUE_TEMPLATE/`.

## Security issues

Do **not** open a public issue for security vulnerabilities — see [SECURITY.md](SECURITY.md).
