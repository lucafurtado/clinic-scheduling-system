// A suíte não depende de uma instância real do AccessCore, Stripe ou de um
// provedor de e-mail — os três são mockados na borda. Isso evita que
// `npm test` fique refém da disponibilidade de serviços externos.
jest.mock('../src/services/accessCoreClient', () => {
  const actual = jest.requireActual('../src/services/accessCoreClient');
  return {
    ...actual,
    accessCoreClient: {
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      meComPermissoes: jest.fn(),
    },
  };
});
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
import { accessCoreClient } from '../src/services/accessCoreClient';

const mockAccessCore = accessCoreClient as jest.Mocked<typeof accessCoreClient>;

const USUARIO_STAFF = {
  id: 'user-staff-uuid',
  email: 'recepcao@horizonte.dev',
  is_active: true,
  full_name: null,
};
const USUARIO_SEM_CLINICA = {
  id: 'user-sem-clinica-uuid',
  email: 'estranho@fora.dev',
  is_active: true,
  full_name: null,
};

async function resetDb() {
  await prisma.pagamento.deleteMany();
  await prisma.agendamento.deleteMany();
  await prisma.paciente.deleteMany();
  await prisma.profissional.deleteMany();
  await prisma.membro.deleteMany();
  await prisma.clinica.deleteMany();

  const clinica = await prisma.clinica.create({
    data: { nome: 'Clínica Horizonte Saúde', slug: 'horizonte-saude' },
  });
  const profissional = await prisma.profissional.create({
    data: {
      clinicaId: clinica.id,
      nome: 'Dr. João Martins',
      especialidade: 'Clínico Geral',
      datasDisponiveis: [new Date('2026-04-20T00:00:00.000Z')],
    },
  });
  await prisma.membro.create({
    data: { clinicaId: clinica.id, accessCoreUserId: USUARIO_STAFF.id },
  });

  return { clinica, profissional };
}

let ctx: Awaited<ReturnType<typeof resetDb>>;

beforeEach(async () => {
  jest.clearAllMocks();
  ctx = await resetDb();
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

describe('POST /clinicas/:slug/auth/login', () => {
  test('faz login, seta cookie de refresh e retorna o access token quando o usuário é membro da clínica', async () => {
    mockAccessCore.login.mockResolvedValue({
      access_token: 'access-token-fake',
      refresh_token: 'refresh-token-fake',
      token_type: 'bearer',
      expires_in: 900,
    });
    mockAccessCore.meComPermissoes.mockResolvedValue({
      usuario: USUARIO_STAFF,
      permissoes: ['profissionais:manage', 'agendamentos:manage'],
    });

    const res = await request(app)
      .post('/clinicas/horizonte-saude/auth/login')
      .send({ email: USUARIO_STAFF.email, password: 'qualquer' });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBe('access-token-fake');
    expect(res.body.usuario.permissoes).toEqual(['profissionais:manage', 'agendamentos:manage']);
    expect(res.headers['set-cookie']?.[0]).toMatch(/hs_refresh_horizonte-saude=.*HttpOnly/);
  });

  test('rejeita login de usuário autenticado no AccessCore mas sem vínculo com esta clínica', async () => {
    mockAccessCore.login.mockResolvedValue({
      access_token: 'access-token-fake',
      refresh_token: 'refresh-token-fake',
      token_type: 'bearer',
      expires_in: 900,
    });
    mockAccessCore.meComPermissoes.mockResolvedValue({
      usuario: USUARIO_SEM_CLINICA,
      permissoes: [],
    });

    const res = await request(app)
      .post('/clinicas/horizonte-saude/auth/login')
      .send({ email: USUARIO_SEM_CLINICA.email, password: 'qualquer' });

    expect(res.status).toBe(403);
  });

  test('credenciais rejeitadas pelo AccessCore viram 401, não 500', async () => {
    const { AccessCoreError } = jest.requireActual('../src/services/accessCoreClient');
    mockAccessCore.login.mockRejectedValue(new AccessCoreError('Falha na autenticação.', 401));

    const res = await request(app)
      .post('/clinicas/horizonte-saude/auth/login')
      .send({ email: USUARIO_STAFF.email, password: 'errada' });

    expect(res.status).toBe(401);
  });
});

describe('rotas administrativas', () => {
  function autenticarComo(usuario: typeof USUARIO_STAFF, permissoes: string[]) {
    mockAccessCore.meComPermissoes.mockResolvedValue({ usuario, permissoes });
  }

  test('401 sem token', async () => {
    const res = await request(app)
      .post('/clinicas/horizonte-saude/admin/profissionais')
      .send({
        nome: 'X',
        especialidade: 'Y',
        datasDisponiveis: ['2026-06-01'],
      });
    expect(res.status).toBe(401);
    expect(mockAccessCore.meComPermissoes).not.toHaveBeenCalled();
  });

  test('403 quando autenticado mas sem vínculo com a clínica', async () => {
    autenticarComo(USUARIO_SEM_CLINICA, ['profissionais:manage']);

    const res = await request(app)
      .post('/clinicas/horizonte-saude/admin/profissionais')
      .set('Authorization', 'Bearer qualquer-coisa')
      .send({ nome: 'X', especialidade: 'Y', datasDisponiveis: ['2026-06-01'] });

    expect(res.status).toBe(403);
  });

  test('403 quando é membro da clínica mas não tem a permissão', async () => {
    autenticarComo(USUARIO_STAFF, []);

    const res = await request(app)
      .post('/clinicas/horizonte-saude/admin/profissionais')
      .set('Authorization', 'Bearer qualquer-coisa')
      .send({ nome: 'X', especialidade: 'Y', datasDisponiveis: ['2026-06-01'] });

    expect(res.status).toBe(403);
  });

  test('201 quando membro da clínica e com a permissão certa', async () => {
    autenticarComo(USUARIO_STAFF, ['profissionais:manage']);

    const res = await request(app)
      .post('/clinicas/horizonte-saude/admin/profissionais')
      .set('Authorization', 'Bearer qualquer-coisa')
      .send({ nome: 'Dr. Novo', especialidade: 'Psiquiatria', datasDisponiveis: ['2026-06-01'] });

    expect(res.status).toBe(201);
    expect(res.body.nome).toBe('Dr. Novo');
  });

  test('equipe cancela um agendamento sem precisar do CPF do paciente', async () => {
    const criado = await request(app).post('/clinicas/horizonte-saude/agendamentos').send({
      nome: 'Paciente Teste',
      cpf: '12345678909',
      telefone: '61999990000',
      email: 'paciente@teste.dev',
      profissionalId: ctx.profissional.id,
      dataConsulta: '2026-04-20',
    });

    autenticarComo(USUARIO_STAFF, ['agendamentos:manage']);

    const res = await request(app)
      .delete(`/clinicas/horizonte-saude/admin/agendamentos/${criado.body.agendamento.id}`)
      .set('Authorization', 'Bearer qualquer-coisa');

    expect(res.status).toBe(200);
  });
});
