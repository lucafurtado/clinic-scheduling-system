import { prisma } from '../lib/prisma';

export const profissionaisRepository = {
  listarEspecialidades(clinicaId: number) {
    return prisma.profissional.findMany({
      where: { clinicaId },
      select: { especialidade: true },
    });
  },

  listarTodos(clinicaId: number, especialidade?: string) {
    return prisma.profissional.findMany({
      where: {
        clinicaId,
        ...(especialidade ? { especialidade: { equals: especialidade, mode: 'insensitive' } } : {}),
      },
      orderBy: { id: 'asc' },
    });
  },

  // findFirst (não findUnique por id) é o que garante o isolamento: um id de
  // profissional de outra clínica nunca bate aqui, mesmo que alguém adivinhe o número.
  buscarPorId(clinicaId: number, id: number) {
    return prisma.profissional.findFirst({ where: { id, clinicaId } });
  },

  criar(
    clinicaId: number,
    dados: { nome: string; especialidade: string; datasDisponiveis: Date[] },
  ) {
    return prisma.profissional.create({ data: { clinicaId, ...dados } });
  },
};
