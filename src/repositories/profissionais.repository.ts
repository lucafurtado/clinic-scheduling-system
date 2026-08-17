import { prisma } from '../lib/prisma';

export const profissionaisRepository = {
  listarEspecialidades() {
    return prisma.profissional.findMany({ select: { especialidade: true } });
  },

  listarTodos(especialidade?: string) {
    return prisma.profissional.findMany({
      where: especialidade
        ? { especialidade: { equals: especialidade, mode: 'insensitive' } }
        : undefined,
      orderBy: { id: 'asc' },
    });
  },

  buscarPorId(id: number) {
    return prisma.profissional.findUnique({ where: { id } });
  },
};
