import { Prisma } from '@prisma/client';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors';
import { agendamentosRepository } from '../repositories/agendamentos.repository';
import { pacientesRepository } from '../repositories/pacientes.repository';
import { profissionaisRepository } from '../repositories/profissionais.repository';
import { notificarDatasAtualizadas } from '../realtime/socket';
import type { CriarAgendamentoInput } from '../schemas/agendamento.schema';
import { emailService } from './emailService';
import { pagamentosService } from './pagamentos.service';
import { formatarData, parseData } from '../utils/data';

type AgendamentoComRelacoes = {
  id: number;
  dataConsulta: Date;
  createdAt: Date;
  profissionalId: number;
  status: string;
  paciente: { nome: string; cpf: string; telefone: string; email: string };
  profissional: { nome: string; especialidade: string };
};

function serializarAgendamento(agendamento: AgendamentoComRelacoes) {
  const dataConsultaStr = formatarData(agendamento.dataConsulta);
  return {
    id: agendamento.id,
    nome: agendamento.paciente.nome,
    cpf: agendamento.paciente.cpf,
    telefone: agendamento.paciente.telefone,
    email: agendamento.paciente.email,
    profissional_id: agendamento.profissionalId,
    data_consulta: dataConsultaStr,
    created_at: agendamento.createdAt.toISOString(),
    especialidade: agendamento.profissional.especialidade,
    profissional: agendamento.profissional.nome,
    dataConsulta: dataConsultaStr,
    status: agendamento.status,
  };
}

export const agendamentosService = {
  async criar(clinicaId: number, clinicaSlug: string, input: CriarAgendamentoInput) {
    const profissional = await profissionaisRepository.buscarPorId(clinicaId, input.profissionalId);
    if (!profissional) throw new NotFoundError('Profissional não encontrado.');

    const datasDisponiveis = profissional.datasDisponiveis.map(formatarData);
    if (!datasDisponiveis.includes(input.dataConsulta)) {
      throw new BadRequestError('Essa data não existe para o profissional selecionado.');
    }

    const paciente = await pacientesRepository.upsert(clinicaId, {
      nome: input.nome,
      cpf: input.cpf,
      telefone: input.telefone,
      email: input.email,
    });

    let agendamento;
    try {
      agendamento = await agendamentosRepository.criar({
        clinicaId,
        pacienteId: paciente.id,
        profissionalId: input.profissionalId,
        dataConsulta: parseData(input.dataConsulta),
      });
    } catch (error) {
      // A constraint única (profissionalId + dataConsulta) fecha a condição de corrida:
      // duas requisições simultâneas para a mesma vaga não podem mais criar dois agendamentos.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestError('Essa data já foi reservada para esse profissional.');
      }
      throw error;
    }

    // A vaga já fica indisponível para outros a partir daqui (o registro existe,
    // mesmo em PENDENTE_PAGAMENTO) — quem estiver olhando esse profissional em
    // tempo real precisa saber agora, não só quando o pagamento for confirmado.
    notificarDatasAtualizadas(clinicaSlug, input.profissionalId);

    let checkoutUrl: string | null;
    try {
      checkoutUrl = await pagamentosService.criarCobranca(clinicaSlug, agendamento);
    } catch (error) {
      // Falha ao iniciar a cobrança (Stripe fora do ar, chave ausente/errada etc.) não
      // pode prender a vaga: remove o agendamento e libera o horário de novo, em vez de
      // deixar um PENDENTE_PAGAMENTO órfão ocupando-o para sempre.
      await agendamentosRepository.remover(agendamento.id);
      notificarDatasAtualizadas(clinicaSlug, input.profissionalId);
      throw error;
    }

    return {
      mensagem: 'Reserva criada. Finalize o pagamento para confirmar o agendamento.',
      agendamento: serializarAgendamento(agendamento),
      checkoutUrl,
    };
  },

  async buscarPorCpf(clinicaId: number, cpf: string) {
    const agendamentos = await agendamentosRepository.buscarPorClinicaEPacienteCpf(clinicaId, cpf);
    return agendamentos.map(serializarAgendamento);
  },

  async cancelar(clinicaId: number, clinicaSlug: string, id: number, cpf: string) {
    const agendamento = await agendamentosRepository.buscarPorId(clinicaId, id);
    if (!agendamento) throw new NotFoundError('Agendamento não encontrado.');

    // Sem login para pacientes (só a área administrativa passa pelo AccessCore) —
    // "ownership" é provado por quem já sabe o CPF usado no agendamento, o mesmo
    // que a tela de busca já exige.
    if (agendamento.paciente.cpf !== cpf) {
      throw new ForbiddenError('CPF não corresponde ao agendamento informado.');
    }

    await agendamentosRepository.remover(id);
    notificarDatasAtualizadas(clinicaSlug, agendamento.profissionalId);
    await emailService.enviarCancelamento(agendamento.paciente.email, {
      nome: agendamento.paciente.nome,
      especialidade: agendamento.profissional.especialidade,
      profissional: agendamento.profissional.nome,
      dataConsulta: formatarData(agendamento.dataConsulta),
    });

    return { mensagem: 'Agendamento cancelado com sucesso.' };
  },

  // Cancelamento pela equipe da clínica (autenticada via AccessCore) — não
  // precisa do CPF do paciente, já que a permissão `agendamentos:manage` é
  // a prova de identidade aqui.
  async cancelarComoEquipe(clinicaId: number, clinicaSlug: string, id: number) {
    const agendamento = await agendamentosRepository.buscarPorId(clinicaId, id);
    if (!agendamento) throw new NotFoundError('Agendamento não encontrado.');

    await agendamentosRepository.remover(id);
    notificarDatasAtualizadas(clinicaSlug, agendamento.profissionalId);
    await emailService.enviarCancelamento(agendamento.paciente.email, {
      nome: agendamento.paciente.nome,
      especialidade: agendamento.profissional.especialidade,
      profissional: agendamento.profissional.nome,
      dataConsulta: formatarData(agendamento.dataConsulta),
    });

    return { mensagem: 'Agendamento cancelado com sucesso.' };
  },
};
