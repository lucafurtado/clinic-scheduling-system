import { prisma } from '../lib/prisma';

export const pagamentosRepository = {
  criar(dados: { agendamentoId: number; stripeSessionId: string; valorCentavos: number }) {
    return prisma.pagamento.create({ data: dados });
  },

  buscarPorStripeSessionId(stripeSessionId: string) {
    return prisma.pagamento.findUnique({
      where: { stripeSessionId },
      include: {
        agendamento: {
          include: { paciente: true, profissional: true, clinica: true },
        },
      },
    });
  },

  marcarConfirmado(id: number) {
    return prisma.pagamento.update({ where: { id }, data: { status: 'CONFIRMADO' } });
  },

  marcarCancelado(id: number) {
    return prisma.pagamento.update({ where: { id }, data: { status: 'CANCELADO' } });
  },
};
