import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const agendamentosRepository = {
  listarDatasOcupadas(clinicaId: number, profissionalId: number) {
    return prisma.agendamento.findMany({
      where: { clinicaId, profissionalId },
      select: { dataConsulta: true },
    });
  },

  criar(data: Prisma.AgendamentoUncheckedCreateInput) {
    return prisma.agendamento.create({
      data,
      include: { paciente: true, profissional: true },
    });
  },

  buscarPorClinicaEPacienteCpf(clinicaId: number, cpf: string) {
    return prisma.agendamento.findMany({
      where: { clinicaId, paciente: { cpf } },
      include: { profissional: true, paciente: true },
      orderBy: { dataConsulta: 'asc' },
    });
  },

  // findFirst (não findUnique por id) garante que um agendamento de outra
  // clínica nunca é encontrado aqui, mesmo sabendo o id.
  buscarPorId(clinicaId: number, id: number) {
    return prisma.agendamento.findFirst({
      where: { id, clinicaId },
      include: { paciente: true, profissional: true },
    });
  },

  remover(id: number) {
    return prisma.agendamento.delete({ where: { id } });
  },

  marcarConfirmado(id: number) {
    return prisma.agendamento.update({
      where: { id },
      data: { status: 'CONFIRMADO' },
      include: { paciente: true, profissional: true },
    });
  },
};
