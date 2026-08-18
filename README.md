# Clínica Horizonte Saúde

Projeto acadêmico (Desenvolvimento de Soluções para Clínica de Saúde) em evolução para uma
plataforma de portfólio multi-clínica: agendamento com reserva de horário, cobrança via Stripe,
confirmação por e-mail e atualização de disponibilidade em tempo real.

> Este README documenta o estado **atual** do código (TypeScript, Express 5, Prisma/PostgreSQL,
> Stripe, Socket.io, Nodemailer, autenticação via um serviço externo chamado AccessCore). A seção
> "Estrutura do projeto" antiga (Backend/Frontend em JS puro com JSON local) descrevia a primeira
> versão acadêmica e não reflete mais a stack.

## Sumário

- [Arquitetura](#arquitetura)
- [Funcionalidades](#funcionalidades)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Rodando localmente](#rodando-localmente-sem-docker)
- [Rodando via Docker](#rodando-via-docker-recomendado)
- [Testes, typecheck, lint e format](#testes-typecheck-lint-e-format)
- [Configurando o Stripe (modo sandbox)](#configurando-o-stripe-modo-sandbox)
- [Validando o webhook com o Stripe CLI](#validando-o-webhook-com-o-stripe-cli)
- [Como funciona o fluxo de pagamento, e-mail e tempo real](#como-funciona-o-fluxo-de-pagamento-e-mail-e-tempo-real)
- [Rotas da API](#rotas-da-api)

## Arquitetura

Camadas: `routes` → `controllers` → `services` → `repositories` (Prisma). Multi-tenant por
`clinicaSlug` na URL (`/clinicas/:clinicaSlug/...`), resolvido pelo middleware
[resolveClinica](src/middleware/resolveClinica.ts) e propagado como `req.clinica`. Autenticação
administrativa delega para um serviço externo de identidade (AccessCore); um usuário só age sobre
uma clínica se houver um registro de `Membro` associando-o a ela (ver `prisma/schema.prisma`).

## Funcionalidades

- Listagem de especialidades e profissionais por clínica
- Reserva de horário com cobrança via **Stripe Checkout** (modo sandbox)
- Confirmação de agendamento assíncrona via **webhook do Stripe**, com liberação automática do
  horário se o pagamento expirar/falhar
- **E-mail transacional** de confirmação e cancelamento (Nodemailer)
- **Atualização em tempo real** (Socket.io) da grade de horários quando alguém reserva, paga ou
  cancela
- Área administrativa (login/gestão de profissionais/cancelamento pela equipe), autenticada via
  AccessCore
- Isolamento multi-clínica de ponta a ponta (dados, autenticação, tempo real)

## Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste. Referência completa (todas as variáveis já têm um
comentário explicativo em `.env.example`):

| Variável                                                                            | Obrigatória                    | Descrição                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                                                                              | não (default `3000`)           | Porta HTTP do servidor.                                                                                                                                                                                                                        |
| `DATABASE_URL`                                                                      | sim                            | Conexão PostgreSQL. Local: `localhost:5434`; dentro do Docker Compose: `db:5432` (o compose já sobrescreve isso).                                                                                                                              |
| `ALLOWED_ORIGINS`                                                                   | não                            | Origens liberadas para CORS, separadas por vírgula. Vazio = CORS fechado (adequado hoje, front e back são same-origin).                                                                                                                        |
| `ACCESSCORE_URL`                                                                    | sim                            | Base URL da instância do AccessCore (provedor de identidade), usada pelas rotas administrativas.                                                                                                                                               |
| `ACCESSCORE_ADMIN_EMAIL` / `ACCESSCORE_ADMIN_PASSWORD`                              | não                            | Só usadas por `scripts/bootstrap-accesscore.ts`, não lidas em runtime pela aplicação.                                                                                                                                                          |
| `APP_BASE_URL`                                                                      | sim                            | URL pública desta aplicação, usada para montar `success_url`/`cancel_url` do Stripe Checkout.                                                                                                                                                  |
| `STRIPE_SECRET_KEY`                                                                 | sim, para o fluxo de pagamento | Chave secreta do Stripe (modo teste: `sk_test_...`). Sem ela, criar uma reserva falha com 500 controlado (ver [Configurando o Stripe](#configurando-o-stripe-modo-sandbox)).                                                                   |
| `STRIPE_WEBHOOK_SECRET`                                                             | sim, para confirmar pagamentos | Segredo (`whsec_...`) usado para validar a assinatura do webhook.                                                                                                                                                                              |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | não                            | Sem `SMTP_HOST`, o serviço de e-mail cria automaticamente uma conta de teste no [Ethereal](https://ethereal.email/) — nenhum e-mail real é enviado, mas o fluxo roda de ponta a ponta e a URL de preview do e-mail aparece no log do servidor. |

Nunca commite um `.env` com chaves reais. `.env` já está no `.gitignore`.

## Rodando localmente (sem Docker)

Pré-requisitos: Node 22+, um PostgreSQL acessível (ex.: `docker compose up db` só para o banco).

```bash
npm install
cp .env.example .env          # ajuste DATABASE_URL etc.
npm run prisma:migrate        # aplica as migrations (cria o schema)
npm run prisma:seed           # popula duas clínicas de exemplo
npm run dev                   # tsx watch — http://localhost:3000
```

## Rodando via Docker (recomendado)

Sobe a aplicação **e** o PostgreSQL, com hot-reload (bind mount do código-fonte):

```bash
docker compose up --build -V   # -V força recriar o volume anônimo do node_modules
```

Na primeira vez (banco vazio), aplique as migrations e o seed dentro do container da app:

```bash
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed
```

A aplicação fica em `http://localhost:3000` e o Postgres exposto em `localhost:5434` (útil para
rodar `npm test`/Prisma Studio a partir do host enquanto o banco vive no container). Para derrubar
tudo (incluindo os dados do Postgres): `docker compose down -v`.

## Testes, typecheck, lint e format

```bash
npm test            # jest — suíte completa (usa DATABASE_URL de tests/jest.setup.ts, banco *_test*)
npm run typecheck    # tsc --noEmit
npm run lint          # eslint .
npm run format:check  # prettier --check .
```

A suíte depende de um PostgreSQL alcançável (local ou o do `docker compose up db`, porta `5434`) e
cria o banco de testes automaticamente na primeira execução via
`TEST_DATABASE_URL`/`DATABASE_URL` (ver `tests/jest.setup.ts`) — crie-o manualmente se necessário:

```bash
docker compose exec db psql -U horizonte -d horizonte_saude -c "CREATE DATABASE horizonte_saude_test;"
DATABASE_URL="postgresql://horizonte:horizonte@localhost:5434/horizonte_saude_test" npx prisma migrate deploy
```

AccessCore, Stripe e o provedor de e-mail são **mockados na borda** nos testes (ver
`tests/jest.setup.ts` e os `jest.mock(...)` no topo de cada arquivo de teste) — a suíte não depende
de nenhum serviço externo real, nem de uma `STRIPE_SECRET_KEY`.

`jest` está configurado com `maxWorkers: 1`: os três arquivos de teste compartilham o mesmo banco
de dados físico e cada um faz `deleteMany()`/recria as tabelas entre casos — rodar os arquivos em
paralelo (o padrão do Jest) causa violação de foreign key entre suítes concorrentes. Isolar por
schema/transação por suíte é uma melhoria possível futura; `maxWorkers: 1` é a solução direta
adotada agora.

## Configurando o Stripe (modo sandbox)

1. Crie uma conta Stripe (gratuita) e pegue a chave secreta de **teste** em
   [dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys) — algo como
   `sk_test_51...`. Nenhuma cobrança real é feita em modo teste.
2. Defina no `.env` (ou nas variáveis do container):
   ```
   STRIPE_SECRET_KEY=sk_test_...
   APP_BASE_URL=http://localhost:3000
   ```
3. Sem `STRIPE_WEBHOOK_SECRET` ainda configurada, o checkout é criado normalmente, mas a
   confirmação do pagamento (que depende do webhook) não acontece — veja a seção abaixo para obter
   esse segredo com o Stripe CLI.
4. Reserve um horário pela interface (ou via `POST /clinicas/:slug/agendamentos`) — a resposta traz
   `checkoutUrl`, um link de checkout hospedado pelo Stripe. Use um
   [cartão de teste](https://docs.stripe.com/testing#cards) (ex.: `4242 4242 4242 4242`, qualquer
   data futura e CVC) para simular um pagamento aprovado.

Sem `STRIPE_SECRET_KEY` configurada, a criação de reserva falha com `500 Erro interno do
servidor` (o erro específico — `STRIPE_SECRET_KEY não configurada.` — fica no log do servidor).
Esse é o comportamento esperado e validado em Docker na ausência de credenciais reais: um erro
controlado, não uma falha silenciosa ou uma queda do servidor.

## Validando o webhook com o Stripe CLI

O webhook (`POST /webhooks/stripe`) precisa da assinatura de cada evento validada contra
`STRIPE_WEBHOOK_SECRET` — sem uma chave `STRIPE_SECRET_KEY` real, não há como gerá-lo. Quando uma
chave de teste estiver disponível, o fluxo completo é:

1. Instale o [Stripe CLI](https://docs.stripe.com/stripe-cli) e autentique: `stripe login`.
2. Com a aplicação rodando (local ou Docker) em `http://localhost:3000`, encaminhe os eventos:
   ```bash
   stripe listen --forward-to localhost:3000/webhooks/stripe
   ```
   O comando imprime um `whsec_...` — copie para `STRIPE_WEBHOOK_SECRET` no `.env` e reinicie a
   aplicação (`docker compose restart app` ou reinicie o `npm run dev`).
3. Com o `stripe listen` ainda rodando em outro terminal, dispare um evento de teste:
   ```bash
   stripe trigger checkout.session.completed
   ```
   Ou, mais representativo do fluxo real: crie uma reserva pela aplicação, abra o `checkoutUrl`
   retornado e pague com o cartão de teste `4242 4242 4242 4242`. O Stripe envia
   `checkout.session.completed` de verdade, o CLI encaminha para `localhost:3000/webhooks/stripe`,
   e você deve ver no log da aplicação a linha `[email] preview: https://ethereal.email/...` (ou o
   envio real, se `SMTP_HOST` estiver configurada) e o agendamento passando para `CONFIRMADO`
   (`GET /clinicas/:slug/agendamentos/:cpf`).
4. Para simular uma sessão expirada/pagamento não concluído: `stripe trigger checkout.session.expired`
   — o agendamento correspondente deve ser removido e o horário liberado (visível em
   `GET /clinicas/:slug/profissionais/:id/datas` e, em tempo real, para quem estiver com aquele
   profissional aberto na tela).

Esse é o único trecho do fluxo que depende de uma credencial Stripe real — todo o resto (criação de
sessão, verificação de assinatura, idempotência, e-mail, tempo real) já está validado por testes
automatizados com mocks (ver `tests/pagamentos.test.ts`) e, no que não depende da chave, em Docker.

## Como funciona o fluxo de pagamento, e-mail e tempo real

1. `POST /clinicas/:slug/agendamentos` valida a data, faz upsert do paciente e cria o
   `Agendamento` com status `PENDENTE_PAGAMENTO` — a constraint única
   `(profissionalId, dataConsulta)` garante que duas requisições simultâneas para a mesma vaga não
   criem dois registros (a segunda recebe 400).
2. A vaga já é considerada ocupada a partir daqui: um evento Socket.io
   `datas:atualizadas` é emitido para a sala `clinica:<slug>:profissional:<id>` (ver
   [src/realtime/socket.ts](src/realtime/socket.ts)), e qualquer cliente com aquele profissional
   selecionado recarrega a lista de datas sem precisar de F5.
3. Em seguida é criada uma sessão do **Stripe Checkout** (`criarSessaoCheckout`, em
   [src/services/stripeClient.ts](src/services/stripeClient.ts)) com expiração de 30 minutos, e um
   registro `Pagamento` (status `PENDENTE`) é persistido vinculado ao agendamento. A resposta ao
   cliente inclui `checkoutUrl` para onde o front redireciona.
4. O Stripe processa o pagamento e chama `POST /webhooks/stripe` de forma assíncrona
   ([src/controllers/webhooks.controller.ts](src/controllers/webhooks.controller.ts)), que valida a
   assinatura (`stripe-signature` contra `STRIPE_WEBHOOK_SECRET`, sobre o corpo **cru** da
   requisição — por isso essa rota usa `express.raw()`, montada antes do `express.json()` global em
   `src/app.ts`) e trata dois eventos:
   - `checkout.session.completed` → `pagamentosService.confirmarPagamento`: marca o pagamento
     `CONFIRMADO`, o agendamento `CONFIRMADO`, e dispara o e-mail de confirmação
     (`emailService.enviarConfirmacao`). Idempotente — reenvios do mesmo evento (garantidos pelo
     próprio contrato do Stripe) não reprocessam nem reenviam e-mail.
   - `checkout.session.expired` → `pagamentosService.cancelarPorFalhaPagamento`: marca o pagamento
     `CANCELADO`, **remove** o agendamento (a vaga volta a ficar disponível de verdade, não fica um
     status "falhou" ocupando o horário) e emite `datas:atualizadas` de novo.
5. Cancelamento manual (pelo paciente via CPF, ou pela equipe da clínica autenticada) segue o mesmo
   padrão: remove o agendamento, emite `datas:atualizadas` e envia o e-mail de cancelamento
   (`emailService.enviarCancelamento`).
6. E-mails nunca derrubam o fluxo que os disparou — falha de envio só é logada
   (`src/services/emailService.ts`). Sem `SMTP_HOST`, cada e-mail é enviado a uma conta de teste
   Ethereal criada sob demanda, e a URL de preview aparece no log do servidor.

## Rotas da API

Todas as rotas abaixo (exceto `/webhooks/stripe`) são montadas sob `/clinicas/:clinicaSlug`, com o
`clinicaSlug` resolvido pelo middleware `resolveClinica` (404 se a clínica não existir).

| Método | Rota                                           | Descrição                                                  |
| ------ | ---------------------------------------------- | ---------------------------------------------------------- |
| GET    | `/especialidades`                              | Lista especialidades distintas da clínica                  |
| GET    | `/profissionais`                               | Lista profissionais (filtro opcional `?especialidade=`)    |
| GET    | `/profissionais/:id/datas`                     | Datas disponíveis de um profissional                       |
| POST   | `/agendamentos`                                | Cria reserva + sessão de checkout Stripe                   |
| GET    | `/agendamentos/:cpf`                           | Busca agendamentos por CPF                                 |
| DELETE | `/agendamentos/:id`                            | Cancela (paciente, exige `cpf` no corpo)                   |
| POST   | `/auth/login`, `/auth/refresh`, `/auth/logout` | Autenticação via AccessCore                                |
| POST   | `/admin/profissionais`                         | Cria profissional (exige permissão `profissionais:manage`) |
| DELETE | `/admin/agendamentos/:id`                      | Cancela como equipe (exige `agendamentos:manage`)          |
| POST   | `/webhooks/stripe`                             | Webhook do Stripe (fora do prefixo de clínica)             |
