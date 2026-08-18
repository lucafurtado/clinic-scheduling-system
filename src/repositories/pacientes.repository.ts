import { prisma } from '../lib/prisma';

export const pacientesRepository = {
  // upsert (não find-then-create) é o que importa aqui: duas reservas
  // simultâneas para um CPF novo na mesma clínica não podem mais colidir
  // fora do try/catch de agendamentosService.criar — o próprio Postgres
  // resolve a corrida de forma atômica numa única instrução.
  upsert(clinicaId: number, dados: { nome: string; cpf: string; telefone: string; email: string }) {
    return prisma.paciente.upsert({
      where: { clinicaId_cpf: { clinicaId, cpf: dados.cpf } },
      create: { clinicaId, ...dados },
      update: { nome: dados.nome, telefone: dados.telefone, email: dados.email },
    });
  },
};
