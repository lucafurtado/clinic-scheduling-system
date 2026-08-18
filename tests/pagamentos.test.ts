jest.mock('../src/services/stripeClient', () => ({
  criarSessaoCheckout: jest.fn(),
  construirEventoWebhook: jest.fn(),
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
import * as stripeClient from '../src/services/stripeClient';

const mockStripe = stripeClient as jest.Mocked<typeof stripeClient>;
const mockEmail = emailService as jest.Mocked<typeof emailService>;

const SESSION_ID = 'cs_test_fake_session';

async function resetDb() {
  await prisma.pagamento.deleteMany();
  await prisma.agendamento.deleteMany();
  await prisma.paciente.deleteMany();
  await prisma.profissional.deleteMany();
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

  return { clinica, profissional };
}

let ctx: Awaited<ReturnType<typeof resetDb>>;

beforeEach(async () => {
  jest.clearAllMocks();
  ctx = await resetDb();
  mockStripe.criarSessaoCheckout.mockResolvedValue({
    sessionId: SESSION_ID,
    checkoutUrl: 'https://checkout.stripe.com/fake',
    valorCentavos: 5000,
  });
});

afterAll(async () => {
  await prisma.pagamento.deleteMany();
  await prisma.agendamento.deleteMany();
  await prisma.paciente.deleteMany();
  await prisma.profissional.deleteMany();
  await prisma.clinica.deleteMany();
  await prisma.$disconnect();
});

function criarReserva() {
  return request(app).post('/clinicas/horizonte-saude/agendamentos').send({
    nome: 'Paciente Teste',
    cpf: '12345678909',
    telefone: '61999990000',
    email: 'paciente@teste.dev',
    profissionalId: ctx.profissional.id,
    dataConsulta: '2026-04-20',
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function enviarWebhook(evento: any) {
  mockStripe.construirEventoWebhook.mockReturnValue(evento);
  return request(app)
    .post('/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .set('Stripe-Signature', 'assinatura-fake-pois-o-mock-nao-valida-de-verdade')
    .send(Buffer.from(JSON.stringify(evento)));
}

describe('POST /clinicas/:slug/agendamentos — falha ao criar a cobrança', () => {
  test('sessão de checkout falha: agendamento não fica preso em PENDENTE_PAGAMENTO, a vaga é liberada', async () => {
    mockStripe.criarSessaoCheckout.mockRejectedValueOnce(
      new Error('STRIPE_SECRET_KEY não configurada.'),
    );

    const res = await criarReserva();
    expect(res.status).toBe(500);

    const busca = await request(app).get('/clinicas/horizonte-saude/agendamentos/12345678909');
    expect(busca.body).toEqual([]);

    const datas = await request(app).get(
      `/clinicas/horizonte-saude/profissionais/${ctx.profissional.id}/datas`,
    );
    expect(datas.body).toContain('2026-04-20');
  });
});

describe('POST /webhooks/stripe', () => {
  test('checkout.session.completed confirma o agendamento e envia e-mail de confirmação', async () => {
    const criado = await criarReserva();
    expect(criado.body.agendamento.status).toBe('PENDENTE_PAGAMENTO');

    const res = await enviarWebhook({
      type: 'checkout.session.completed',
      data: { object: { id: SESSION_ID } },
    });
    expect(res.status).toBe(200);

    const busca = await request(app).get('/clinicas/horizonte-saude/agendamentos/12345678909');
    expect(busca.body[0].status).toBe('CONFIRMADO');
    expect(mockEmail.enviarConfirmacao).toHaveBeenCalledTimes(1);
    expect(mockEmail.enviarConfirmacao).toHaveBeenCalledWith(
      'paciente@teste.dev',
      expect.objectContaining({ dataConsulta: '2026-04-20' }),
    );
  });

  test('reenvio do mesmo evento não reprocessa (idempotência)', async () => {
    await criarReserva();

    await enviarWebhook({
      type: 'checkout.session.completed',
      data: { object: { id: SESSION_ID } },
    });
    await enviarWebhook({
      type: 'checkout.session.completed',
      data: { object: { id: SESSION_ID } },
    });

    expect(mockEmail.enviarConfirmacao).toHaveBeenCalledTimes(1);
  });

  test('checkout.session.expired remove o agendamento e libera a vaga', async () => {
    await criarReserva();

    const res = await enviarWebhook({
      type: 'checkout.session.expired',
      data: { object: { id: SESSION_ID } },
    });
    expect(res.status).toBe(200);

    const datas = await request(app).get(
      `/clinicas/horizonte-saude/profissionais/${ctx.profissional.id}/datas`,
    );
    expect(datas.body).toContain('2026-04-20');

    const busca = await request(app).get('/clinicas/horizonte-saude/agendamentos/12345678909');
    expect(busca.body).toEqual([]);
  });

  test('assinatura inválida retorna 400 e não altera nada', async () => {
    await criarReserva();
    mockStripe.construirEventoWebhook.mockImplementation(() => {
      throw new Error('assinatura inválida');
    });

    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', 'ruim')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(400);

    const busca = await request(app).get('/clinicas/horizonte-saude/agendamentos/12345678909');
    expect(busca.body[0].status).toBe('PENDENTE_PAGAMENTO');
  });

  test('evento de tipo não tratado é apenas confirmado (200) sem efeito colateral', async () => {
    await criarReserva();

    const res = await enviarWebhook({
      type: 'payment_intent.created',
      data: { object: { id: 'irrelevante' } },
    });
    expect(res.status).toBe(200);
    expect(mockEmail.enviarConfirmacao).not.toHaveBeenCalled();
  });
});
