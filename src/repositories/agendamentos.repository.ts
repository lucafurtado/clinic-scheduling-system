import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const agendamentosRepository = {
  listarDatasOcupadas(profissionalId: number) {
    return prisma.agendamento.findMany({
      where: { profissionalId },
      select: { dataConsulta: true },
    });
  },

  criar(data: Prisma.AgendamentoUncheckedCreateInput) {
    return prisma.agendamento.create({ data });
  },

  buscarPorCpf(cpf: string) {
    return prisma.agendamento.findMany({
      where: { cpf },
      include: { profissional: true },
      orderBy: { dataConsulta: 'asc' },
    });
  },

  buscarPorId(id: number) {
    return prisma.agendamento.findUnique({ where: { id } });
  },

  remover(id: number) {
    return prisma.agendamento.delete({ where: { id } });
  },
};
