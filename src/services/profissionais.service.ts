import { NotFoundError } from '../errors';
import { agendamentosRepository } from '../repositories/agendamentos.repository';
import { profissionaisRepository } from '../repositories/profissionais.repository';
import { formatarData, parseData } from '../utils/data';

export const profissionaisService = {
  async listarEspecialidades(clinicaId: number) {
    const profissionais = await profissionaisRepository.listarEspecialidades(clinicaId);
    return [...new Set(profissionais.map((p) => p.especialidade))];
  },

  listarProfissionais(clinicaId: number, especialidade?: string) {
    return profissionaisRepository.listarTodos(clinicaId, especialidade);
  },

  async listarDatasDisponiveis(clinicaId: number, profissionalId: number) {
    const profissional = await profissionaisRepository.buscarPorId(clinicaId, profissionalId);
    if (!profissional) throw new NotFoundError('Profissional não encontrado.');

    const ocupados = await agendamentosRepository.listarDatasOcupadas(clinicaId, profissionalId);
    const datasOcupadas = new Set(ocupados.map((a) => formatarData(a.dataConsulta)));

    return profissional.datasDisponiveis
      .map(formatarData)
      .filter((data) => !datasOcupadas.has(data));
  },

  criar(
    clinicaId: number,
    dados: { nome: string; especialidade: string; datasDisponiveis: string[] },
  ) {
    return profissionaisRepository.criar(clinicaId, {
      nome: dados.nome,
      especialidade: dados.especialidade,
      datasDisponiveis: dados.datasDisponiveis.map(parseData),
    });
  },
};
