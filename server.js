const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const dataFile = path.join(__dirname, 'data.json');

function criarDadosIniciais() {
  return {
    profissionais: [
      {
        id: 1,
        nome: 'Dr. João Martins',
        especialidade: 'Clínico Geral',
        datasDisponiveis: ['2026-04-20', '2026-04-21', '2026-04-22']
      },
      {
        id: 2,
        nome: 'Dra. Fernanda Rocha',
        especialidade: 'Clínico Geral',
        datasDisponiveis: ['2026-04-27', '2026-04-28']
      },
      {
        id: 3,
        nome: 'Dra. Marina Costa',
        especialidade: 'Nutrição',
        datasDisponiveis: ['2026-04-23', '2026-04-24']
      },
      {
        id: 4,
        nome: 'Dr. Carlos Abreu',
        especialidade: 'Exames',
        datasDisponiveis: ['2026-04-25', '2026-04-26']
      },
      {
        id: 5,
        nome: 'Dra. Camila Nogueira',
        especialidade: 'Pediatria',
        datasDisponiveis: ['2026-04-29', '2026-04-30']
      },
      {
        id: 6,
        nome: 'Dr. Rafael Teixeira',
        especialidade: 'Cardiologia',
        datasDisponiveis: ['2026-05-02', '2026-05-03']
      },
      {
        id: 7,
        nome: 'Dra. Paula Mendes',
        especialidade: 'Dermatologia',
        datasDisponiveis: ['2026-05-04', '2026-05-05']
      },
      {
        id: 8,
        nome: 'Dr. Eduardo Lima',
        especialidade: 'Ortopedia',
        datasDisponiveis: ['2026-05-06', '2026-05-07']
      },
      {
        id: 9,
        nome: 'Dra. Juliana Barros',
        especialidade: 'Ginecologia',
        datasDisponiveis: ['2026-05-08', '2026-05-09']
      },
      {
        id: 10,
        nome: 'Dr. André Soares',
        especialidade: 'Neurologia',
        datasDisponiveis: ['2026-05-10', '2026-05-11']
      }
    ],
    agendamentos: []
  };
}

function lerDados() {
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(criarDadosIniciais(), null, 2));
  }

  const conteudo = fs.readFileSync(dataFile, 'utf8');
  return JSON.parse(conteudo);
}

function salvarDados(dados) {
  fs.writeFileSync(dataFile, JSON.stringify(dados, null, 2));
}

function limparCPF(cpf) {
  return String(cpf).replace(/\D/g, '');
}

app.get('/', (req, res) => {
  res.send('API da Clínica Horizonte Saúde rodando');
});

app.get('/especialidades', (req, res) => {
  const dados = lerDados();
  const especialidades = [...new Set(dados.profissionais.map(p => p.especialidade))];
  res.json(especialidades);
});

app.get('/profissionais', (req, res) => {
  const dados = lerDados();
  const { especialidade } = req.query;

  let profissionais = dados.profissionais;

  if (especialidade) {
    profissionais = profissionais.filter(
      p => p.especialidade.toLowerCase() === especialidade.toLowerCase()
    );
  }

  res.json(profissionais);
});

app.get('/profissionais/:id/datas', (req, res) => {
  const dados = lerDados();
  const profissional = dados.profissionais.find(p => p.id == req.params.id);

  if (!profissional) {
    return res.status(404).json({ erro: 'Profissional não encontrado.' });
  }

  const datasOcupadas = dados.agendamentos
    .filter(a => a.profissionalId == profissional.id)
    .map(a => a.dataConsulta);

  const datasLivres = profissional.datasDisponiveis.filter(
    data => !datasOcupadas.includes(data)
  );

  res.json(datasLivres);
});

app.post('/agendamentos', (req, res) => {
  const { nome, cpf, profissionalId, dataConsulta } = req.body;

  if (!nome || !cpf || !profissionalId || !dataConsulta) {
    return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
  }

  const cpfLimpo = limparCPF(cpf);

  if (!/^\d{11}$/.test(cpfLimpo)) {
    return res.status(400).json({ erro: 'CPF deve ter 11 dígitos, com ou sem formatação.' });
  }

  const dados = lerDados();
  const profissional = dados.profissionais.find(p => p.id == profissionalId);

  if (!profissional) {
    return res.status(404).json({ erro: 'Profissional não encontrado.' });
  }

  const dataExisteParaProfissional = profissional.datasDisponiveis.includes(dataConsulta);
  if (!dataExisteParaProfissional) {
    return res.status(400).json({ erro: 'Essa data não existe para o profissional selecionado.' });
  }

  const conflito = dados.agendamentos.find(
    a => a.profissionalId == profissionalId && a.dataConsulta === dataConsulta
  );

  if (conflito) {
    return res.status(400).json({ erro: 'Essa data já foi reservada para esse profissional.' });
  }

  const novoAgendamento = {
    id: Date.now(),
    nome,
    cpf: cpfLimpo,
    especialidade: profissional.especialidade,
    profissionalId: profissional.id,
    profissional: profissional.nome,
    dataConsulta
  };

  dados.agendamentos.push(novoAgendamento);
  salvarDados(dados);

  res.status(201).json({
    mensagem: 'Agendamento realizado com sucesso.',
    agendamento: novoAgendamento
  });
});

app.get('/agendamentos/:cpf', (req, res) => {
  const cpfBuscado = limparCPF(req.params.cpf);
  const dados = lerDados();
  const encontrados = dados.agendamentos.filter(a => a.cpf === cpfBuscado);
  res.json(encontrados);
});

app.delete('/agendamentos/:id', (req, res) => {
  const { id } = req.params;
  const dados = lerDados();

  const index = dados.agendamentos.findIndex(a => a.id == id);

  if (index === -1) {
    return res.status(404).json({ erro: 'Agendamento não encontrado.' });
  }

  dados.agendamentos.splice(index, 1);
  salvarDados(dados);

  res.json({ mensagem: 'Agendamento cancelado com sucesso.' });
});

app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
});