import { prisma } from '../lib/prisma';

export const clinicasRepository = {
  buscarPorSlug(slug: string) {
    return prisma.clinica.findUnique({ where: { slug } });
  },

  buscarPorId(id: number) {
    return prisma.clinica.findUnique({ where: { id } });
  },
};
