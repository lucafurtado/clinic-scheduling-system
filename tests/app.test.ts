import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';

type ProfissionalSeed = {
  nome: string;
  especialidade: string;
  datas: string[];
};

const seedPadrao: ProfissionalSeed[] = [
  { nome: 'Dr. João Martins', especialidade: 'Clínico Geral', datas: ['2026-04-20', '2026-04-21'] },
  { nome: 'Dra. Marina Costa', especialidade: 'Nutrição', datas: ['2026-04-23'] },
];

async function resetDb(profissionaisSeed: ProfissionalSeed[] = seedPadrao) {
  await prisma.agendamento.deleteMany();
  await prisma.profissional.deleteMany();

  const criados = [];
  for (const p of profissionaisSeed) {
    criados.push(
      await prisma.profissional.create({
        data: {
          nome: p.nome,
          especialidade: p.especialidade,
          datasDisponiveis: p.datas.map((d) => new Date(`${d}T00:00:00.000Z`)),
        },
      }),
    );
  }
  return criados;
}

let profissionais: Awaited<ReturnType<typeof resetDb>>;

beforeEach(async () => {
  profissionais = await resetDb();
});

afterAll(async () => {
  await prisma.agendamento.deleteMany();
  await prisma.profissional.deleteMany();
  await prisma.$disconnect();
});

describe('GET /especialidades', () => {
  test('lista especialidades únicas dos profissionais cadastrados', async () => {
    const res = await request(app).get('/especialidades');
    expect(res.status).toBe(200);
    expect([...res.body].sort()).toEqual(['Clínico Geral', 'Nutrição']);
  });
});

describe('GET /profissionais', () => {
  test('lista todos os profissionais quando nenhum filtro é passado', async () => {
    const res = await request(app).get('/profissionais');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('filtra por especialidade quando o query param é passado (case-insensitive)', async () => {
    const res = await request(app).get('/profissionais').query({ especialidade: 'nutrição' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].nome).toBe('Dra. Marina Costa');
  });
});

describe('GET /profissionais/:id/datas', () => {
  test('retorna as datas disponíveis excluindo as já agendadas', async () => {
    const [joao] = profissionais;
    await prisma.agendamento.create({
      data: {
        nome: 'X',
        cpf: '11111111111',
        telefone: '1',
        profissionalId: joao.id,
        dataConsulta: new Date('2026-04-20T00:00:00.000Z'),
      },
    });

    const res = await request(app).get(`/profissionais/${joao.id}/datas`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(['2026-04-21']);
  });

  test('retorna 404 para profissional inexistente', async () => {
    const res = await request(app).get('/profissionais/999999/datas');
    expect(res.status).toBe(404);
  });

  test('retorna 400 para id não numérico', async () => {
    const res = await request(app).get('/profissionais/abc/datas');
    expect(res.status).toBe(400);
  });
});

describe('POST /agendamentos', () => {
  test('cria um agendamento válido e normaliza o CPF', async () => {
    const [joao] = profissionais;
    const res = await request(app).post('/agendamentos').send({
      nome: 'Paciente Teste',
      cpf: '123.456.789-09',
      telefone: '(61) 99999-0000',
      profissionalId: joao.id,
      dataConsulta: '2026-04-20',
    });

    expect(res.status).toBe(201);
    expect(res.body.mensagem).toMatch(/sucesso/i);
    expect(res.body.agendamento.cpf).toBe('12345678909');
    expect(res.body.agendamento.profissional).toBe('Dr. João Martins');
    expect(res.body.agendamento.especialidade).toBe('Clínico Geral');
  });

  test('rejeita quando falta campo obrigatório', async () => {
    const [joao] = profissionais;
    const res = await request(app).post('/agendamentos').send({
      cpf: '12345678909',
      telefone: '61999990000',
      profissionalId: joao.id,
      dataConsulta: '2026-04-20',
    });
    expect(res.status).toBe(400);
  });

  test('rejeita CPF com formato inválido', async () => {
    const [joao] = profissionais;
    const res = await request(app).post('/agendamentos').send({
      nome: 'Paciente Teste',
      cpf: '123',
      telefone: '61999990000',
      profissionalId: joao.id,
      dataConsulta: '2026-04-20',
    });
    expect(res.status).toBe(400);
  });

  test('rejeita data fora da lista de datas do profissional', async () => {
    const [joao] = profissionais;
    const res = await request(app).post('/agendamentos').send({
      nome: 'Paciente Teste',
      cpf: '12345678909',
      telefone: '61999990000',
      profissionalId: joao.id,
      dataConsulta: '2099-01-01',
    });
    expect(res.status).toBe(400);
  });

  test('rejeita data já reservada pelo mesmo profissional (constraint única do banco)', async () => {
    const [joao] = profissionais;
    await prisma.agendamento.create({
      data: {
        nome: 'Outro Paciente',
        cpf: '00000000000',
        telefone: '0',
        profissionalId: joao.id,
        dataConsulta: new Date('2026-04-20T00:00:00.000Z'),
      },
    });

    const res = await request(app).post('/agendamentos').send({
      nome: 'Paciente Teste',
      cpf: '12345678909',
      telefone: '61999990000',
      profissionalId: joao.id,
      dataConsulta: '2026-04-20',
    });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/já foi reservada/i);
  });

  test('duas reservas simultâneas para a mesma vaga: só uma vence (condição de corrida)', async () => {
    const [joao] = profissionais;
    const payload = {
      nome: 'Paciente Concorrente',
      cpf: '98765432100',
      telefone: '61999990000',
      profissionalId: joao.id,
      dataConsulta: '2026-04-21',
    };

    const [a, b] = await Promise.all([
      request(app).post('/agendamentos').send(payload),
      request(app).post('/agendamentos').send(payload),
    ]);

    const statusCodes = [a.status, b.status].sort();
    expect(statusCodes).toEqual([201, 400]);
  });
});

describe('GET /agendamentos/:cpf', () => {
  test('retorna os agendamentos do paciente com dados do profissional', async () => {
    const [joao] = profissionais;
    await prisma.agendamento.create({
      data: {
        nome: 'Paciente Teste',
        cpf: '12345678909',
        telefone: '1',
        profissionalId: joao.id,
        dataConsulta: new Date('2026-04-20T00:00:00.000Z'),
      },
    });

    const res = await request(app).get('/agendamentos/123.456.789-09');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].profissional).toBe('Dr. João Martins');
    expect(res.body[0].especialidade).toBe('Clínico Geral');
  });

  test('retorna lista vazia quando não há agendamentos para o CPF', async () => {
    const res = await request(app).get('/agendamentos/00000000000');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('DELETE /agendamentos/:id', () => {
  test('cancela um agendamento existente quando o CPF confere', async () => {
    const [joao] = profissionais;
    const agendamento = await prisma.agendamento.create({
      data: {
        nome: 'Paciente Teste',
        cpf: '12345678909',
        telefone: '1',
        profissionalId: joao.id,
        dataConsulta: new Date('2026-04-20T00:00:00.000Z'),
      },
    });

    const res = await request(app)
      .delete(`/agendamentos/${agendamento.id}`)
      .send({ cpf: '123.456.789-09' });
    expect(res.status).toBe(200);

    const busca = await request(app).get('/agendamentos/12345678909');
    expect(busca.body).toEqual([]);
  });

  test('rejeita cancelamento com CPF que não corresponde ao agendamento', async () => {
    const [joao] = profissionais;
    const agendamento = await prisma.agendamento.create({
      data: {
        nome: 'Paciente Teste',
        cpf: '12345678909',
        telefone: '1',
        profissionalId: joao.id,
        dataConsulta: new Date('2026-04-20T00:00:00.000Z'),
      },
    });

    const res = await request(app)
      .delete(`/agendamentos/${agendamento.id}`)
      .send({ cpf: '00000000000' });
    expect(res.status).toBe(403);

    const busca = await request(app).get('/agendamentos/12345678909');
    expect(busca.body).toHaveLength(1);
  });

  test('rejeita cancelamento sem CPF no corpo da requisição', async () => {
    const [joao] = profissionais;
    const agendamento = await prisma.agendamento.create({
      data: {
        nome: 'Paciente Teste',
        cpf: '12345678909',
        telefone: '1',
        profissionalId: joao.id,
        dataConsulta: new Date('2026-04-20T00:00:00.000Z'),
      },
    });

    const res = await request(app).delete(`/agendamentos/${agendamento.id}`).send({});
    expect(res.status).toBe(400);
  });

  test('retorna 404 ao cancelar agendamento inexistente', async () => {
    const res = await request(app).delete('/agendamentos/999999').send({ cpf: '12345678909' });
    expect(res.status).toBe(404);
  });
});

describe('CORS', () => {
  test('sem ALLOWED_ORIGINS configurada, não libera Access-Control-Allow-Origin', async () => {
    const res = await request(app)
      .get('/especialidades')
      .set('Origin', 'https://exemplo-externo.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
