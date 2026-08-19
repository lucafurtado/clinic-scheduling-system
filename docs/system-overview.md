# System Overview

## What ClinicFlow does

ClinicFlow is a multi-tenant scheduling platform for healthcare clinics. A patient picks a
specialty, a professional, and an available date; reserving that slot requires an online payment
(Stripe Checkout) to hold it, which both guarantees the slot and removes the "free to cancel, so
free to no-show" incentive that costs small clinics real revenue. Once payment is confirmed
(async, via webhook), the patient gets an email confirmation and the slot disappears in real time
for anyone else looking at that professional's calendar.

The platform serves **multiple independent clinics** from one deployment — each with its own URL
namespace, staff, professionals and patients, fully isolated from every other clinic on the
platform.

## Actors

| Actor                                           | Can do                                                                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Patient** (unauthenticated)                   | Browse specialties/professionals/availability, reserve + pay, look up their own bookings by CPF, cancel their own booking    |
| **Clinic staff** (authenticated via AccessCore) | Everything a patient can, plus: manage professionals, cancel any booking for their clinic, without needing the patient's CPF |
| **Platform operator** (this repo's maintainer)  | Deploys the platform, provisions new clinics, manages the AccessCore identity instance                                       |

## Domain model

```mermaid
erDiagram
    Clinica ||--o{ Profissional : has
    Clinica ||--o{ Paciente : has
    Clinica ||--o{ Agendamento : has
    Clinica ||--o{ Membro : has
    Profissional ||--o{ Agendamento : "booked for"
    Paciente ||--o{ Agendamento : makes
    Agendamento ||--o| Pagamento : "billed by"

    Clinica {
        int id PK
        string nome
        string slug UK
    }
    Profissional {
        int id PK
        int clinicaId FK
        string nome
        string especialidade
        date[] datasDisponiveis
    }
    Paciente {
        int id PK
        int clinicaId FK
        string nome
        string cpf "unique per clinicaId"
        string telefone
        string email
    }
    Agendamento {
        int id PK
        int clinicaId FK
        int pacienteId FK
        int profissionalId FK
        date dataConsulta
        enum status "PENDENTE_PAGAMENTO | CONFIRMADO"
    }
    Pagamento {
        int id PK
        int agendamentoId FK UK
        string stripeSessionId UK
        int valorCentavos
        enum status "PENDENTE | CONFIRMADO | CANCELADO"
    }
    Membro {
        int id PK
        int clinicaId FK
        string accessCoreUserId "external identity, not FK"
    }
```

Two constraints do most of the correctness work in this schema:

- `Agendamento` is unique on `(profissionalId, dataConsulta)` — the database itself rejects a
  second booking for an already-taken slot, closing the race condition rather than relying on
  application-level locking.
- `Paciente` is unique on `(clinicaId, cpf)`, not on `cpf` alone — the same CPF is a _different_
  patient record in a different clinic, matching the tenant-isolation guarantee end to end, down
  to the data model.

## External integrations

| Service                      | Role                                                                    | Where                                                                    |
| ---------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **AccessCore**               | Identity provider — login, token validation, RBAC permission resolution | `src/services/accessCoreClient.ts`                                       |
| **Stripe**                   | Checkout session creation + webhook-driven payment confirmation         | `src/services/stripeClient.ts`, `src/controllers/webhooks.controller.ts` |
| **SMTP (Resend / Ethereal)** | Transactional email (confirmation/cancellation)                         | `src/services/emailService.ts`                                           |
| **Socket.io**                | Real-time availability updates, scoped per clinic + professional room   | `src/realtime/socket.ts`                                                 |

## Folder structure

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

prisma/
├── schema.prisma                # source of truth for the data model
├── migrations/                   # one directory per applied migration
└── seed.ts                       # demo data (two example clinics)

tests/                             # Jest + Supertest, real Postgres, external services mocked
docs/                               # this folder
```

See [architecture.md](architecture.md) for how these layers interact and
[deployment.md](deployment.md) for how the system is actually run in production.
