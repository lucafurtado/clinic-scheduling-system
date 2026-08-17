import { NotFoundError } from '../errors';
import { agendamentosRepository } from '../repositories/agendamentos.repository';
import { profissionaisRepository } from '../repositories/profissionais.repository';
import { formatarData } from '../utils/data';

export const profissionaisService = {
  async listarEspecialidades() {
    const profissionais = await profissionaisRepository.listarEspecialidades();
    return [...new Set(profissionais.map((p) => p.especialidade))];
  },

  listarProfissionais(especialidade?: string) {
    return profissionaisRepository.listarTodos(especialidade);
  },

  async listarDatasDisponiveis(profissionalId: number) {
    const profissional = await profissionaisRepository.buscarPorId(profissionalId);
    if (!profissional) throw new NotFoundError('Profissional não encontrado.');

    const ocupados = await agendamentosRepository.listarDatasOcupadas(profissionalId);
    const datasOcupadas = new Set(ocupados.map((a) => formatarData(a.dataConsulta)));

    return profissional.datasDisponiveis
      .map(formatarData)
      .filter((data) => !datasOcupadas.has(data));
  },
};
