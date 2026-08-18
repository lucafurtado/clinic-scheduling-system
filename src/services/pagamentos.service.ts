import { agendamentosRepository } from '../repositories/agendamentos.repository';
import { pagamentosRepository } from '../repositories/pagamentos.repository';
import { notificarDatasAtualizadas } from '../realtime/socket';
import { emailService } from './emailService';
import { criarSessaoCheckout } from './stripeClient';
import { formatarData } from '../utils/data';

interface AgendamentoParaCobranca {
  id: number;
  profissionalId: number;
  dataConsulta: Date;
  paciente: { nome: string; email: string };
  profissional: { nome: string; especialidade: string };
}

export const pagamentosService = {
  async criarCobranca(clinicaSlug: string, agendamento: AgendamentoParaCobranca) {
    const { sessionId, checkoutUrl, valorCentavos } = await criarSessaoCheckout({
      agendamentoId: agendamento.id,
      clinicaSlug,
      descricao: `${agendamento.profissional.especialidade} com ${agendamento.profissional.nome}`,
      emailPaciente: agendamento.paciente.email,
    });

    await pagamentosRepository.criar({
      agendamentoId: agendamento.id,
      stripeSessionId: sessionId,
      valorCentavos,
    });

    return checkoutUrl;
  },

  // Idempotente: o Stripe pode reenviar o mesmo evento de webhook mais de uma
  // vez (é o contrato deles, não uma falha) — se o pagamento já está
  // CONFIRMADO, não reprocessa (não reenvia e-mail, não emite socket de novo).
  async confirmarPagamento(stripeSessionId: string) {
    const pagamento = await pagamentosRepository.buscarPorStripeSessionId(stripeSessionId);
    if (!pagamento) return;
    if (pagamento.status === 'CONFIRMADO') return;

    await pagamentosRepository.marcarConfirmado(pagamento.id);
    await agendamentosRepository.marcarConfirmado(pagamento.agendamentoId);

    const { paciente, profissional, clinica } = pagamento.agendamento;
    const dataConsultaStr = formatarData(pagamento.agendamento.dataConsulta);

    await emailService.enviarConfirmacao(paciente.email, {
      nome: paciente.nome,
      especialidade: profissional.especialidade,
      profissional: profissional.nome,
      dataConsulta: dataConsultaStr,
    });

    // A vaga já estava ocupada desde a criação (pending) — não é preciso
    // notificar "sumiu" de novo aqui; a confirmação não muda disponibilidade.
    void clinica;
  },

  // Pagamento recusado/expirado: a vaga é liberada de verdade (o agendamento
  // é removido, não fica um status "falhou" ocupando o horário para sempre).
  async cancelarPorFalhaPagamento(stripeSessionId: string) {
    const pagamento = await pagamentosRepository.buscarPorStripeSessionId(stripeSessionId);
    if (!pagamento) return;
    if (pagamento.status !== 'PENDENTE') return;

    await pagamentosRepository.marcarCancelado(pagamento.id);
    await agendamentosRepository.remover(pagamento.agendamentoId);

    const { clinica, profissionalId } = pagamento.agendamento;
    notificarDatasAtualizadas(clinica.slug, profissionalId);
  },
};
