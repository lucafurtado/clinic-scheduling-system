// Stripe e e-mail são mockados na borda — os testes daqui não devem depender
// de rede (nem da API real do Stripe, nem de criar uma conta de teste no
// Ethereal a cada run). O fluxo de pagamento em si é testado à parte em
// tests/pagamentos.test.ts.
// stripeSessionId é @unique no banco — cada chamada precisa de um id novo,
// senão a segunda reserva criada num teste esbarra na constraint única.
let contadorSessaoFake = 0;
jest.mock('../src/services/stripeClient', () => ({
  criarSessaoCheckout: jest.fn().mockImplementation(() =>
    Promise.resolve({
      sessionId: `cs_test_fake_${++contadorSessaoFake}`,
      checkoutUrl: 'https://checkout.stripe.com/fake',
      valorCentavos: 5000,
    }),
  ),
}));
jest.mock('../src/services/emailService', () => ({
  emailService: {
    enviarConfirmacao: jest.fn().mockResolvedValue(undefined),
    enviarCancelamento: jest.fn().mockResolvedValue(undefined),
  },
}));

import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { emailService } from '../src/services/emailService';

const mockEmailService = emailService as jest.Mocked<typeof emailService>;

type ProfissionalSeed = {
  nome: string;
  especialidade: string;
  datas: string[];
};

type ClinicaSeed = {
  nome: string;
  slug: string;
  profissionais: ProfissionalSeed[];
};

const seedPadrao: ClinicaSeed[] = [
  {
    nome: 'Clínica Horizonte Saúde',
    slug: 'horizonte-saude',
    profissionais: [
      {
        nome: 'Dr. João Martins',
        especialidade: 'Clínico Geral',
        datas: ['2026-04-20', '2026-04-21'],
      },
      { nome: 'Dra. Marina Costa', especialidade: 'Nutrição', datas: ['2026-04-23'] },
    ],
  },
  {
    nome: 'Clínica Vida Plena',
    slug: 'vida-plena',
    profissionais: [
      { nome: 'Dra. Beatriz Lopes', especialidade: 'Clínico Geral', datas: ['2026-04-20'] },
    ],
  },
];

const PACIENTE_PADRAO = {
  nome: 'Paciente Teste',
  telefone: '61999990000',
  email: 'paciente@teste.dev',
};

async function resetDb(clinicasSeed: ClinicaSeed[] = seedPadrao) {
  await prisma.pagamento.deleteMany();
  await prisma.agendamento.deleteMany();
  await prisma.paciente.deleteMany();
  await prisma.profissional.deleteMany();
  await prisma.membro.deleteMany();
  await prisma.clinica.deleteMany();

  const clinicas: Record<string, { id: number; profissionais: { id: number; nome: string }[] }> =
    {};

  for (const c of clinicasSeed) {
    const clinica = await prisma.clinica.create({ data: { nome: c.nome, slug: c.slug } });
    const profissionais = [];
    for (const p of c.profissionais) {
      profissionais.push(
        await prisma.profissional.create({
          data: {
            clinicaId: clinica.id,
            nome: p.nome,
            especialidade: p.especialidade,
            datasDisponiveis: p.datas.map((d) => new Date(`${d}T00:00:00.000Z`)),
          },
        }),
      );
    }
    clinicas[c.slug] = { id: clinica.id, profissionais };
  }

  return clinicas;
}

let clinicas: Awaited<ReturnType<typeof resetDb>>;

beforeEach(async () => {
  jest.clearAllMocks();
  clinicas = await resetDb();
});

afterAll(async () => {
  await prisma.pagamento.deleteMany();
  await prisma.agendamento.deleteMany();
  await prisma.paciente.deleteMany();
  await prisma.profissional.deleteMany();
  await prisma.membro.deleteMany();
  await prisma.clinica.deleteMany();
  await prisma.$disconnect();
});

describe('resolução de clínica', () => {
  test('retorna 404 para slug de clínica inexistente', async () => {
    const res = await request(app).get('/clinicas/nao-existe/especialidades');
    expect(res.status).toBe(404);
  });
});

describe('GET /clinicas/:slug/especialidades', () => {
  test('lista só as especialidades da clínica do slug', async () => {
    const res = await request(app).get('/clinicas/horizonte-saude/especialidades');
    expect(res.status).toBe(200);
    expect([...res.body].sort()).toEqual(['Clínico Geral', 'Nutrição']);
  });
});

describe('GET /clinicas/:slug/profissionais', () => {
  test('lista só os profissionais da própria clínica', async () => {
    const res = await request(app).get('/clinicas/horizonte-saude/profissionais');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('isolamento: a outra clínica não vê os profissionais desta', async () => {
    const res = await request(app).get('/clinicas/vida-plena/profissionais');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].nome).toBe('Dra. Beatriz Lopes');
  });
});

describe('isolamento entre clínicas (Fase 7)', () => {
  test('id de profissional de outra clínica não é acessível via o slug errado', async () => {
    const idDaOutraClinica = clinicas['vida-plena'].profissionais[0].id;

    const viaClinicaErrada = await request(app).get(
      `/clinicas/horizonte-saude/profissionais/${idDaOutraClinica}/datas`,
    );
    expect(viaClinicaErrada.status).toBe(404);

    const viaClinicaCerta = await request(app).get(
      `/clinicas/vida-plena/profissionais/${idDaOutraClinica}/datas`,
    );
    expect(viaClinicaCerta.status).toBe(200);
  });

  test('o mesmo CPF é um paciente diferente em cada clínica', async () => {
    const profHorizonte = clinicas['horizonte-saude'].profissionais[0];
    const profVidaPlena = clinicas['vida-plena'].profissionais[0];

    await request(app)
      .post('/clinicas/horizonte-saude/agendamentos')
      .send({
        ...PACIENTE_PADRAO,
        cpf: '12345678909',
        profissionalId: profHorizonte.id,
        dataConsulta: '2026-04-20',
      });

    const buscaNaClinicaCerta = await request(app).get(
      '/clinicas/horizonte-saude/agendamentos/12345678909',
    );
    expect(buscaNaClinicaCerta.body).toHaveLength(1);

    const buscaNaOutraClinica = await request(app).get(
      '/clinicas/vida-plena/agendamentos/12345678909',
    );
    expect(buscaNaOutraClinica.body).toEqual([]);

    // o mesmo CPF pode agendar normalmente na outra clínica, como um paciente distinto
    const res = await request(app)
      .post('/clinicas/vida-plena/agendamentos')
      .send({
        ...PACIENTE_PADRAO,
        cpf: '12345678909',
        profissionalId: profVidaPlena.id,
        dataConsulta: '2026-04-20',
      });
    expect(res.status).toBe(201);
  });
});

describe('POST /clinicas/:slug/agendamentos', () => {
  test('cria uma reserva pendente de pagamento e devolve o checkoutUrl', async () => {
    const prof = clinicas['horizonte-saude'].profissionais[0];
    const res = await request(app)
      .post('/clinicas/horizonte-saude/agendamentos')
      .send({
        ...PACIENTE_PADRAO,
        cpf: '123.456.789-09',
        profissionalId: prof.id,
        dataConsulta: '2026-04-20',
      });

    expect(res.status).toBe(201);
    expect(res.body.checkoutUrl).toBe('https://checkout.stripe.com/fake');
    expect(res.body.agendamento.status).toBe('PENDENTE_PAGAMENTO');
    expect(res.body.agendamento.cpf).toBe('12345678909');
    expect(res.body.agendamento.profissional).toBe('Dr. João Martins');
  });

  test('a vaga já fica indisponível para outros mesmo com o pagamento pendente', async () => {
    const prof = clinicas['horizonte-saude'].profissionais[0];
    await request(app)
      .post('/clinicas/horizonte-saude/agendamentos')
      .send({
        ...PACIENTE_PADRAO,
        cpf: '12345678909',
        profissionalId: prof.id,
        dataConsulta: '2026-04-20',
      });

    const datas = await request(app).get(
      `/clinicas/horizonte-saude/profissionais/${prof.id}/datas`,
    );
    expect(datas.body).not.toContain('2026-04-20');
  });

  test('rejeita data já reservada pelo mesmo profissional', async () => {
    const prof = clinicas['horizonte-saude'].profissionais[0];
    const payload = {
      ...PACIENTE_PADRAO,
      cpf: '12345678909',
      profissionalId: prof.id,
      dataConsulta: '2026-04-20',
    };

    await request(app).post('/clinicas/horizonte-saude/agendamentos').send(payload);
    const res = await request(app)
      .post('/clinicas/horizonte-saude/agendamentos')
      .send({ ...payload, cpf: '00000000000' });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/já foi reservada/i);
  });

  test('rejeita quando falta o e-mail', async () => {
    const prof = clinicas['horizonte-saude'].profissionais[0];
    const res = await request(app).post('/clinicas/horizonte-saude/agendamentos').send({
      nome: 'Paciente Teste',
      cpf: '12345678909',
      telefone: '61999990000',
      profissionalId: prof.id,
      dataConsulta: '2026-04-20',
    });
    expect(res.status).toBe(400);
  });

  test('duas reservas simultâneas para a mesma vaga: só uma vence (condição de corrida)', async () => {
    const prof = clinicas['horizonte-saude'].profissionais[0];
    const payload = {
      ...PACIENTE_PADRAO,
      cpf: '98765432100',
      profissionalId: prof.id,
      dataConsulta: '2026-04-21',
    };

    const [a, b] = await Promise.all([
      request(app).post('/clinicas/horizonte-saude/agendamentos').send(payload),
      request(app).post('/clinicas/horizonte-saude/agendamentos').send(payload),
    ]);

    const statusCodes = [a.status, b.status].sort();
    expect(statusCodes).toEqual([201, 400]);
  });

  test('não encontra o profissional de uma clínica ao tentar agendar em outra', async () => {
    const profDaOutraClinica = clinicas['vida-plena'].profissionais[0];
    const res = await request(app)
      .post('/clinicas/horizonte-saude/agendamentos')
      .send({
        ...PACIENTE_PADRAO,
        cpf: '12345678909',
        profissionalId: profDaOutraClinica.id,
        dataConsulta: '2026-04-20',
      });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /clinicas/:slug/agendamentos/:id', () => {
  test('cancela quando o CPF confere e dispara e-mail de cancelamento', async () => {
    const prof = clinicas['horizonte-saude'].profissionais[0];
    const criado = await request(app)
      .post('/clinicas/horizonte-saude/agendamentos')
      .send({
        ...PACIENTE_PADRAO,
        cpf: '12345678909',
        profissionalId: prof.id,
        dataConsulta: '2026-04-20',
      });

    const res = await request(app)
      .delete(`/clinicas/horizonte-saude/agendamentos/${criado.body.agendamento.id}`)
      .send({ cpf: '12345678909' });

    expect(res.status).toBe(200);
    expect(mockEmailService.enviarCancelamento).toHaveBeenCalledWith(
      PACIENTE_PADRAO.email,
      expect.objectContaining({ nome: PACIENTE_PADRAO.nome }),
    );
  });

  test('rejeita CPF que não corresponde', async () => {
    const prof = clinicas['horizonte-saude'].profissionais[0];
    const criado = await request(app)
      .post('/clinicas/horizonte-saude/agendamentos')
      .send({
        ...PACIENTE_PADRAO,
        cpf: '12345678909',
        profissionalId: prof.id,
        dataConsulta: '2026-04-20',
      });

    const res = await request(app)
      .delete(`/clinicas/horizonte-saude/agendamentos/${criado.body.agendamento.id}`)
      .send({ cpf: '00000000000' });
    expect(res.status).toBe(403);
  });
});
