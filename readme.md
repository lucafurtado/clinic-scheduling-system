# Clínica Horizonte Saúde

Projeto acadêmico desenvolvido para a atividade de **Desenvolvimento de Soluções para Clínica de Saúde**.

## Descrição

A aplicação simula um sistema de agendamento para uma clínica de saúde, permitindo que o usuário:

- escolha uma especialidade
- selecione um profissional
- visualize as datas disponíveis
- preencha nome e CPF
- confirme um agendamento
- consulte agendamentos por CPF
- cancele um agendamento

> **Nota (em evolução):** este projeto está sendo evoluído de um MVP acadêmico para uma plataforma de portfólio completa (TypeScript, Prisma, autenticação, multi-clínica, deploy em produção, etc.). A stack e a estrutura de pastas abaixo refletem o estado **atual** do código, não o estado final planejado.

Os dados são armazenados em um banco **PostgreSQL gerenciado (Supabase)**, acessado via `@supabase/supabase-js`. O armazenamento local em JSON descrito nas seções abaixo foi o desenho original da atividade acadêmica e não reflete mais o comportamento atual do `server.js`.

## Funcionalidades implementadas

- Listagem de especialidades
- Listagem de profissionais por especialidade
- Exibição de datas disponíveis por profissional
- Bloqueio automático de datas já agendadas
- Formulário de agendamento com nome e CPF
- Consulta de agendamentos por CPF
- Cancelamento de agendamento
- Armazenamento local em arquivo JSON
- Interface visual organizada e responsiva

## Tecnologias utilizadas

- HTML
- CSS
- JavaScript
- Node.js
- Express
- JSON para armazenamento local

## Estrutura do projeto

```text
Clínica
├── Backend
│   ├── data.json
│   ├── package-lock.json
│   ├── package.json
│   ├── server.js
│   └── node_modules
├── Frontend
│   ├── index.html
│   └── style.css
└── README.md
```
