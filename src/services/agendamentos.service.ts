import { Prisma } from '@prisma/client';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors';
import { agendamentosRepository } from '../repositories/agendamentos.repository';
import { profissionaisRepository } from '../repositories/profissionais.repository';
import type { CriarAgendamentoInput } from '../schemas/agendamento.schema';
import { formatarData, parseData } from '../utils/data';

function serializarAgendamento(
  agendamento: {
    id: number;
    nome: string;
    cpf: string;
    telefone: string;
    profissionalId: number;
    dataConsulta: Date;
    createdAt: Date;
  },
  especialidade: string,
  nomeProfissional: string,
) {
  const dataConsultaStr = formatarData(agendamento.dataConsulta);
  return {
    id: agendamento.id,
    nome: agendamento.nome,
    cpf: agendamento.cpf,
    telefone: agendamento.telefone,
    profissional_id: agendamento.profissionalId,
    data_consulta: dataConsultaStr,
    created_at: agendamento.createdAt.toISOString(),
    especialidade,
    profissional: nomeProfissional,
    dataConsulta: dataConsultaStr,
  };
}

export const agendamentosService = {
  async criar(input: CriarAgendamentoInput) {
    const profissional = await profissionaisRepository.buscarPorId(input.profissionalId);
    if (!profissional) throw new NotFoundError('Profissional não encontrado.');

    const datasDisponiveis = profissional.datasDisponiveis.map(formatarData);
    if (!datasDisponiveis.includes(input.dataConsulta)) {
      throw new BadRequestError('Essa data não existe para o profissional selecionado.');
    }

    try {
      const agendamento = await agendamentosRepository.criar({
        nome: input.nome,
        cpf: input.cpf,
        telefone: input.telefone,
        profissionalId: input.profissionalId,
        dataConsulta: parseData(input.dataConsulta),
      });

      return {
        mensagem: 'Agendamento realizado com sucesso.',
        agendamento: serializarAgendamento(
          agendamento,
          profissional.especialidade,
          profissional.nome,
        ),
      };
    } catch (error) {
      // A constraint única (profissionalId + dataConsulta) fecha a condição de corrida:
      // duas requisições simultâneas para a mesma vaga não podem mais criar dois agendamentos.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestError('Essa data já foi reservada para esse profissional.');
      }
      throw error;
    }
  },

  async buscarPorCpf(cpf: string) {
    const agendamentos = await agendamentosRepository.buscarPorCpf(cpf);
    return agendamentos.map((a) =>
      serializarAgendamento(a, a.profissional.especialidade, a.profissional.nome),
    );
  },

  async cancelar(id: number, cpf: string) {
    const agendamento = await agendamentosRepository.buscarPorId(id);
    if (!agendamento) throw new NotFoundError('Agendamento não encontrado.');

    // Sem login ainda (chega na Fase 8/AccessCore) — até lá, "ownership" é provado
    // por quem já sabe o CPF usado no agendamento, o mesmo que a tela de busca exige.
    if (agendamento.cpf !== cpf) {
      throw new ForbiddenError('CPF não corresponde ao agendamento informado.');
    }

    await agendamentosRepository.remover(id);
    return { mensagem: 'Agendamento cancelado com sucesso.' };
  },
};
