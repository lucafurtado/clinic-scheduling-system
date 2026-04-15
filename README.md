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

Os dados são armazenados localmente em **JSON**, conforme solicitado na atividade.

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
