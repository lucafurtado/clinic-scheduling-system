# Horizonte Saúde

Plataforma de agendamento multi-clínica: paciente reserva um horário, paga online para confirmar,
recebe e-mail de confirmação e a agenda atualiza em tempo real para qualquer outra pessoa olhando
o mesmo profissional. Evoluída de um MVP acadêmico (front-end estático + `server.js` + JSON local)
para uma stack TypeScript/Prisma/PostgreSQL com autenticação delegada, isolamento real entre
clínicas e deploy em produção.

**App em produção:** https://horizonte-saude-api.onrender.com _(free tier — o primeiro request
após um tempo sem uso pode levar 30-60s para "acordar" o servidor)_
**Repositório:** https://github.com/lucafurtado/clinic-scheduling-system

## Sumário

- [Visão de negócio](#visão-de-negócio)
- [Arquitetura](#arquitetura)
- [Stack](#stack)
- [Decisões técnicas](#decisões-técnicas)
- [Funcionalidades](#funcionalidades)
- [Multi-tenancy](#multi-tenancy)
- [Autenticação via AccessCore](#autenticação-via-accesscore)
- [Pagamentos (Stripe)](#pagamentos-stripe)
- [Tempo real (Socket.io)](#tempo-real-socketio)
- [E-mail transacional](#e-mail-transacional)
- [Testes](#testes)
- [Rodando localmente](#rodando-localmente-sem-docker)
- [Rodando via Docker](#rodando-via-docker)
- [Deploy](#deploy)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Rotas da API](#rotas-da-api)
- [Roadmap futuro](#roadmap-futuro)
- [Capturas de tela](#capturas-de-tela)

## Visão de negócio

Clínicas pequenas perdem receita de duas formas específicas que este projeto ataca diretamente:

- **No-show sem custo para o paciente** — reservar não custa nada, então cancelar (ou simplesmente
  não aparecer) também não custa nada. Exigir uma reserva de horário paga na hora de agendar muda
  esse incentivo sem precisar de um sistema de cobrança manual.
- **Agenda desatualizada entre quem está olhando ao mesmo tempo** — sem tempo real, dois pacientes
  podem estar vendo a mesma data "disponível" simultaneamente; um deles vai descobrir que perdeu o
  horário só depois de tentar confirmar.

O produto é pensado para **múltiplas clínicas na mesma plataforma** (não uma instância por
cliente): cada clínica tem sua própria URL (`/clinicas/:slug`), sua própria equipe, seus próprios
profissionais e pacientes — sem ver nada da clínica vizinha. Uma segunda clínica de exemplo
(`vida-plena`) existe nos dados de seed exatamente para provar esse isolamento, não só descrevê-lo.

## Arquitetura

Camadas: **routes → controllers → services → repositories → Prisma/PostgreSQL**. Cada camada só
conhece a de baixo; a lógica de negócio (services) não sabe nada sobre Express, e os repositories
não sabem nada sobre regras de negócio — só executam queries.

```mermaid
flowchart TB
    subgraph Cliente
        Browser["Navegador (index.html + JS)"]
    end

    subgraph "Horizonte Saúde (Node/Express)"
        API["routes → controllers → services → repositories"]
        Socket["Socket.io"]
    end

    subgraph Externos
        AccessCore["AccessCore\n(identidade, fora deste repo)"]
        Stripe["Stripe Checkout\n(sandbox)"]
        SMTP["SMTP\n(Resend / Ethereal)"]
    end

    DB[("PostgreSQL")]

    Browser -- "REST + WebSocket" --> API
    Browser <-. "datas:atualizadas" .-> Socket
    API --> DB
    API -- "login / validar token" --> AccessCore
    API -- "criar sessão de checkout" --> Stripe
    Stripe -- "webhook assinado" --> API
    API -- "confirmação / cancelamento" --> SMTP
    API --> Socket
```

Um middleware (`resolveClinica`) resolve `:clinicaSlug` no início de toda rota de negócio e
popula `req.clinica` — nenhum controller/service abaixo dele precisa saber que multi-tenancy
existe, só recebe um `clinicaId` já resolvido e validado (404 antes de qualquer outra coisa se o
slug não existir).

## Stack

| Camada        | Escolha                                                                                 | Por quê                                                                                                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Linguagem     | TypeScript                                                                              | Tipagem de ponta a ponta entre schema (Prisma), services e controllers — a maioria dos bugs de "campo errado" vira erro de compilação, não de runtime.                                                       |
| Web framework | Express 5                                                                               | Suporte nativo a handlers `async` (erros em promises chegam ao `errorHandler` sem `try/catch` manual em cada rota) — motivo real de não ter ficado no Express 4.                                             |
| ORM           | Prisma 7 (`@prisma/adapter-pg`)                                                         | Migrations versionadas, client com tipos gerados do schema, e o adapter `pg` evita o driver Rust anterior do Prisma.                                                                                         |
| Banco         | PostgreSQL 16                                                                           | Constraints únicas compostas (`profissionalId+dataConsulta`, `clinicaId+cpf`) fazem o banco fechar condições de corrida que o código sozinho não fecharia de forma confiável.                                |
| Identidade    | AccessCore (serviço externo, [repo próprio](https://github.com/lucafurtado/accesscore)) | Login, RBAC e emissão/validação de token não são o domínio deste projeto — delegar evita reimplementar autenticação (e os bugs de segurança que vêm junto) numa segunda vez.                                 |
| Pagamentos    | Stripe Checkout (modo sandbox)                                                          | Checkout hospedado pelo Stripe — nenhum dado de cartão passa por este backend.                                                                                                                               |
| Tempo real    | Socket.io                                                                               | Fallback automático para long-polling quando WebSocket não está disponível (proxies corporativos, etc.), sem código extra.                                                                                   |
| E-mail        | Nodemailer + Ethereal (dev) / Resend (produção)                                         | Nodemailer é agnóstico de provedor — trocar de Ethereal para Resend é só configuração, sem mudar código.                                                                                                     |
| Logging       | pino / pino-http                                                                        | JSON estruturado em produção (consumível por qualquer agregador de log), pretty-print em dev.                                                                                                                |
| Testes        | Jest + Supertest, `ts-jest`                                                             | Testes de integração reais contra Postgres (não mocks de banco) — só AccessCore/Stripe/e-mail são mockados, por serem serviços externos.                                                                     |
| Deploy        | Render (Web Service + PostgreSQL)                                                       | Processo Node persistente — necessário para conexões WebSocket do Socket.io, que não sobrevivem bem a um modelo serverless tradicional (motivo pelo qual o `vercel.json` original foi removido; ver Deploy). |

## Decisões técnicas

Um resumo das decisões que não são óbvias só de ler o código (o racional completo de cada uma
está comentado no arquivo correspondente):

- **Reserva "trava" o horário antes do pagamento ser confirmado.** O agendamento é criado com
  status `PENDENTE_PAGAMENTO` e já ocupa a vaga (a constraint única não distingue status) — a
  alternativa (só reservar depois do pagamento confirmado) permitiria dois pacientes pagarem pelo
  mesmo horário em paralelo, com um dos dois tendo que ser estornado depois.
- **Falha ao criar a sessão de pagamento libera a vaga imediatamente**, em vez de deixar um
  `PENDENTE_PAGAMENTO` órfão. Bug real encontrado e corrigido durante a validação deste projeto —
  ver [Bugs encontrados](#bugs-encontrados-e-como-foram-resolvidos) no relatório do checkpoint.
- **Webhook do Stripe usa `express.raw()`, montado antes do `express.json()` global.** A
  verificação de assinatura (`stripe.webhooks.constructEvent`) precisa dos bytes crus do corpo —
  um body já reparseado pelo `express.json()` invalidaria a assinatura.
- **Confirmação de pagamento é idempotente.** O Stripe pode reenviar o mesmo evento de webhook
  mais de uma vez (contrato deles, não uma falha) — se o pagamento já está `CONFIRMADO`, o handler
  não reprocessa (não reenvia e-mail, não emite Socket.io de novo).
- **CPF é único por clínica, não globalmente.** O mesmo CPF pode ser um paciente diferente (registro
  diferente) em outra clínica — é o mesmo isolamento de tenant aplicado até o nível de dado.
- **CSP do Helmet está desligada deliberadamente.** O front-end atual usa `<script>` inline e
  atributos `onclick="..."` — a CSP padrão bloquearia os dois e quebraria a aplicação. Documentado
  como troca consciente (ver `src/app.ts`), não como um item esquecido.
- **`npm run build` compila `prisma/seed.ts` separadamente** (`prisma/tsconfig.seed.json` →
  `dist/prisma/seed.js`), fora do `tsconfig.json` principal. Motivo: rodar o seed em produção não
  pode depender de `tsx`, que é uma devDependency ausente num install de produção (bug real
  encontrado no primeiro deploy — ver relatório do checkpoint).
- **`prisma`, `typescript` e os pacotes `@types/*` usados pelo código-fonte vivem em
  `dependencies`, não `devDependencies`.** Plataformas de deploy costumam pular devDependencies
  quando `NODE_ENV=production` — sem isso, o build de produção falha (outro bug real, mesmo
  relatório).

## Funcionalidades

- Listagem de especialidades e profissionais por clínica
- Consulta de datas disponíveis por profissional (já descontando o que está reservado)
- Reserva de horário com cobrança via Stripe Checkout
- Confirmação automática do agendamento quando o pagamento é aprovado (via webhook)
- Liberação automática do horário se o pagamento expirar ou falhar
- Cancelamento pelo paciente (via CPF) ou pela equipe da clínica (autenticada)
- E-mail de confirmação e de cancelamento
- Atualização em tempo real da grade de horários (Socket.io)
- Login/administração da clínica via AccessCore, com RBAC por permissão
- Isolamento completo entre clínicas (dados, autenticação, tempo real)

## Multi-tenancy

Toda rota de negócio vive sob `/clinicas/:clinicaSlug/...`. O middleware `resolveClinica`
(`src/middleware/resolveClinica.ts`) resolve o slug para uma `Clinica` real (404 se não existir) e
anexa `req.clinica` — a partir daí, todo repository filtra por `clinicaId` explicitamente (nunca um
`findUnique` só por id de um recurso filho, sempre `findFirst({ where: { id, clinicaId } })`), o
que fecha a possibilidade de vazamento cross-tenant mesmo que alguém adivinhe o id de um recurso de
outra clínica.

O vínculo entre um usuário do AccessCore e uma clínica vive inteiramente neste banco (modelo
`Membro`) — o AccessCore não sabe (nem precisa saber) o que é uma "clínica"; essa fronteira de
domínio é responsabilidade só deste serviço.

## Autenticação via AccessCore

A área administrativa (`/admin/*`) não reimplementa login: delega para o
[AccessCore](https://github.com/lucafurtado/accesscore), um serviço de identidade genérico
(`https://accesscore-backend.onrender.com`, [docs](https://accesscore-backend.onrender.com/docs)).

Fluxo: `POST /clinicas/:slug/auth/login` chama o AccessCore, recebe um token, busca as permissões
efetivas do usuário e confere se existe um `Membro` ligando esse usuário a esta clínica (senão,
403 mesmo com credenciais válidas — login certo não significa acesso a _esta_ clínica). O refresh
token vai num cookie `httpOnly`, escopado por clínica (`path: /clinicas/:slug/auth`), para que o
mesmo navegador possa manter sessões independentes em clínicas diferentes.

Cada rota administrativa exige uma permissão específica (`profissionais:manage`,
`agendamentos:manage`) verificada contra o retorno do AccessCore — nenhum JWT é decodificado
localmente; a validação (assinatura, expiração, usuário ativo) e a resolução de permissões
acontecem sempre no próprio AccessCore, então revogar uma role lá já vale aqui na próxima
requisição, sem esperar o token expirar.

## Pagamentos (Stripe)

Ver a explicação completa do fluxo (reserva → checkout → webhook → confirmação/e-mail/tempo real)
em [Decisões técnicas](#decisões-técnicas) acima. Para configurar credenciais de teste e validar
webhooks com o Stripe CLI:

1. Crie uma conta Stripe e pegue a chave secreta de **teste** em
   [dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys) (`sk_test_...`).
   Modo sandbox — nenhuma cobrança real.
2. Configure `STRIPE_SECRET_KEY` e `APP_BASE_URL` (ver [Variáveis de ambiente](#variáveis-de-ambiente)).
3. Sem `STRIPE_WEBHOOK_SECRET`, o checkout é criado normalmente mas a confirmação (que depende do
   webhook) não acontece. Para validar isso:
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/webhooks/stripe
   # copie o whsec_... impresso para STRIPE_WEBHOOK_SECRET, reinicie a app
   stripe trigger checkout.session.completed
   # ou: reserve um horário pela app, pague no checkoutUrl com 4242 4242 4242 4242
   stripe trigger checkout.session.expired   # simula pagamento não concluído
   ```

**Sem `STRIPE_SECRET_KEY` configurada** (o estado padrão deste repo — nenhuma chave fictícia é
usada), criar uma reserva falha com `500 Erro interno do servidor`, controlado — o horário não fica
preso (ver [Decisões técnicas](#decisões-técnicas)). É o comportamento validado tanto localmente
quanto no deploy de produção.

## Tempo real (Socket.io)

Cada cliente entra numa sala `clinica:<slug>:profissional:<id>` ao selecionar um profissional
(`src/realtime/socket.ts`). Reservar, confirmar pagamento, cancelar ou uma reserva expirar — tudo
isso emite `datas:atualizadas` só para quem está na sala daquele profissional específico (não um
broadcast geral), mantendo o mesmo isolamento de tenant também em tempo real.

## E-mail transacional

`src/services/emailService.ts`: sem `SMTP_HOST` configurada, cria automaticamente uma conta de
teste [Ethereal](https://ethereal.email/) — nenhum e-mail real é enviado, mas o fluxo roda de
ponta a ponta e a URL de preview aparece no log do servidor. Uma falha de envio nunca derruba o
fluxo que a disparou (reserva/cancelamento continuam válidos mesmo se o e-mail falhar) — só é
logada. Em produção, configurar `SMTP_*` para um provedor real (recomendado: Resend).

## Testes

```bash
npm test            # suíte completa (Jest + Supertest)
npm run typecheck    # tsc --noEmit
npm run lint          # eslint .
npm run format:check  # prettier --check .
```

AccessCore, Stripe e o provedor de e-mail são mockados na borda (`tests/jest.setup.ts` e os
`jest.mock(...)` no topo de cada arquivo) — a suíte não depende de nenhum serviço externo real,
nem de credenciais. O resto (banco de dados, regras de negócio, isolamento multi-tenant, RBAC) roda
de ponta a ponta contra um Postgres real.

Depende de um Postgres alcançável na porta `5434` (local ou via `docker compose up db`):

```bash
docker compose exec db psql -U horizonte -d horizonte_saude -c "CREATE DATABASE horizonte_saude_test;"
DATABASE_URL="postgresql://horizonte:horizonte@localhost:5434/horizonte_saude_test" npx prisma migrate deploy
```

`jest` roda com `maxWorkers: 1`: os três arquivos de teste compartilham o mesmo banco físico e cada
um reseta as tabelas entre casos — rodar em paralelo (o padrão do Jest) causa violação de foreign
key entre suítes concorrentes.

## Rodando localmente (sem Docker)

Pré-requisitos: Node 22+, um PostgreSQL acessível (ex.: `docker compose up db` só para o banco).

```bash
npm install
cp .env.example .env          # ajuste DATABASE_URL etc.
npm run prisma:migrate        # aplica as migrations
npm run prisma:seed           # popula duas clínicas de exemplo
npm run dev                   # tsx watch — http://localhost:3000
```

## Rodando via Docker

```bash
docker compose up --build -V   # -V força recriar o volume anônimo do node_modules
docker compose exec app npx prisma migrate deploy   # primeira vez (banco vazio)
docker compose exec app npx prisma db seed
```

App em `http://localhost:3000`, Postgres exposto em `localhost:5434` (para rodar `npm test`/Prisma
Studio do host enquanto o banco vive no container). `docker compose down -v` derruba tudo,
incluindo os dados.

## Deploy

Deploy atual: **Render** — Web Service (Node, plano free) + PostgreSQL (plano free, mesma região).
Motivo de não ser Vercel (a plataforma usada na primeira versão deste projeto, ver o
`vercel.json` removido no histórico): o modelo serverless da Vercel não sustenta as conexões
WebSocket persistentes que o Socket.io precisa — um Web Service com processo Node contínuo, como o
do Render, é necessário para o tempo real funcionar de verdade em produção, não só localmente.

Este repositório inclui um [render.yaml](render.yaml) (Blueprint) com a mesma configuração usada em
produção — a forma mais simples de reproduzir o deploy é:

1. Em [dashboard.render.com](https://dashboard.render.com) → **New +** → **Blueprint** → conecte
   este repositório. O Render detecta o `render.yaml` e provisiona o Web Service + o Postgres.
2. Preencha as variáveis marcadas `sync: false` (`APP_BASE_URL` — a URL que o Render atribuir ao
   serviço; `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`SMTP_*` se/quando disponíveis) direto no
   dashboard — nunca ficam commitadas.
3. `npm start` (`prisma migrate deploy && node dist/server.js`) aplica as migrations pendentes
   automaticamente a cada deploy — não é um passo manual separado.
4. Popular o banco de produção pela primeira vez: como o plano free do Render não inclui _one-off
   jobs_, o seed foi rodado apontando temporariamente o _start command_ do serviço para
   `... && node dist/prisma/seed.js && node dist/server.js` por um deploy, e revertido em seguida
   — documentado em detalhe no relatório do Checkpoint 5.

**Nota sobre o plano free:** o Postgres free do Render expira automaticamente 30 dias após a
criação (é preciso recriar o banco — ou migrar para um plano pago — antes disso para não perder os
dados); o Web Service free "dorme" após 15 minutos sem tráfego (mesmo trade-off já aceito hoje pelo
AccessCore, que roda no mesmo tipo de plano).

## Variáveis de ambiente

Copie `.env.example` para `.env`. Referência completa (todas comentadas no próprio arquivo):

| Variável                                                                            | Obrigatória                    | Descrição                                                                                              |
| ----------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `PORT`                                                                              | não (default `3000`)           | Porta HTTP.                                                                                            |
| `NODE_ENV`                                                                          | não                            | `production` ativa log JSON puro e cookie de refresh com `Secure`.                                     |
| `LOG_LEVEL`                                                                         | não (default `info`)           | Nível mínimo de log do pino.                                                                           |
| `DATABASE_URL`                                                                      | sim                            | Conexão PostgreSQL.                                                                                    |
| `ALLOWED_ORIGINS`                                                                   | não                            | Origens de CORS liberadas, separadas por vírgula. Vazio = fechado (front e back são same-origin hoje). |
| `ACCESSCORE_URL`                                                                    | sim                            | Base URL (com `/api/v1`) da instância do AccessCore.                                                   |
| `ACCESSCORE_ADMIN_EMAIL` / `ACCESSCORE_ADMIN_PASSWORD`                              | não                            | Só para `scripts/bootstrap-accesscore.ts`, não lidas em runtime.                                       |
| `APP_BASE_URL`                                                                      | sim                            | URL pública desta app, usada nos links de retorno do Stripe Checkout.                                  |
| `STRIPE_SECRET_KEY`                                                                 | sim, para pagamentos           | Chave secreta do Stripe (`sk_test_...`).                                                               |
| `STRIPE_WEBHOOK_SECRET`                                                             | sim, para confirmar pagamentos | Segredo (`whsec_...`) do webhook.                                                                      |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | não                            | Sem `SMTP_HOST`, cai no fallback Ethereal (dev/teste).                                                 |

## Rotas da API

Todas as rotas abaixo (exceto `/health` e `/webhooks/stripe`) vivem sob `/clinicas/:clinicaSlug`.

| Método | Rota                                           | Descrição                                         |
| ------ | ---------------------------------------------- | ------------------------------------------------- |
| GET    | `/health`                                      | Healthcheck (checa conectividade com o banco)     |
| GET    | `/especialidades`                              | Especialidades distintas da clínica               |
| GET    | `/profissionais`                               | Profissionais (filtro opcional `?especialidade=`) |
| GET    | `/profissionais/:id/datas`                     | Datas disponíveis de um profissional              |
| POST   | `/agendamentos`                                | Cria reserva + sessão de checkout Stripe          |
| GET    | `/agendamentos/:cpf`                           | Busca agendamentos por CPF                        |
| DELETE | `/agendamentos/:id`                            | Cancela (paciente, exige `cpf` no corpo)          |
| POST   | `/auth/login`, `/auth/refresh`, `/auth/logout` | Autenticação via AccessCore                       |
| POST   | `/admin/profissionais`                         | Cria profissional (`profissionais:manage`)        |
| DELETE | `/admin/agendamentos/:id`                      | Cancela como equipe (`agendamentos:manage`)       |
| POST   | `/webhooks/stripe`                             | Webhook do Stripe                                 |

## Roadmap futuro

Itens conhecidos e deliberadamente fora do escopo atual (não são bugs — são a linha onde este
projeto parou de propósito):

- **Convite de membro para uma clínica.** Hoje, associar um usuário do AccessCore a uma clínica
  (tabela `Membro`) é feito por acesso direto ao banco — não existe uma rota `POST
/admin/membros`. Razoável para uma clínica só (ou para o portfólio); um fluxo de convite por
  e-mail seria o próximo passo natural para várias clínicas se auto-gerenciando.
- **CSP com nonce.** Exigiria mover o `<script>` inline do `index.html` para um arquivo externo —
  ver [Decisões técnicas](#decisões-técnicas).
- **Job de limpeza de reservas órfãs** para o caso (raro, mas possível) de o Stripe ficar
  indisponível bem no meio da criação da sessão de checkout, depois do agendamento já ter sido
  criado — hoje esse caso específico já não trava a vaga (ver bug corrigido no relatório do
  Checkpoint 5), mas um job periódico seria uma camada extra de segurança.
- **Front-end como aplicação separada** (hoje é HTML/CSS/JS estático servido pelo próprio Express)
  — pré-requisito, junto com a CSP, para uma UI mais rica sem reescrever o backend.
- **Histórico de pagamento pós-cancelamento.** Cancelar um agendamento já pago também remove o
  registro de `Pagamento` (cascade) — manter histórico exigiria soft-delete no `Agendamento`.

## Capturas de tela

_Adicione aqui screenshots/GIF do fluxo de reserva, do painel administrativo e do e-mail de
confirmação — a aplicação está no ar em https://horizonte-saude-api.onrender.com para gravar._
