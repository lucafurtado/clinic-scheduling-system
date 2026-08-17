import { Request, Response } from 'express';
import {
  agendamentoIdParamSchema,
  cancelarAgendamentoBodySchema,
  cpfParamSchema,
  criarAgendamentoSchema,
} from '../schemas/agendamento.schema';
import { agendamentosService } from '../services/agendamentos.service';

export async function criar(req: Request, res: Response) {
  const dados = criarAgendamentoSchema.parse(req.body);
  const resultado = await agendamentosService.criar(dados);
  res.status(201).json(resultado);
}

export async function buscarPorCpf(req: Request, res: Response) {
  const { cpf } = cpfParamSchema.parse(req.params);
  const cpfLimpo = cpf.replace(/\D/g, '');
  const resultado = await agendamentosService.buscarPorCpf(cpfLimpo);
  res.json(resultado);
}

export async function cancelar(req: Request, res: Response) {
  const { id } = agendamentoIdParamSchema.parse(req.params);
  const { cpf } = cancelarAgendamentoBodySchema.parse(req.body);
  const resultado = await agendamentosService.cancelar(id, cpf);
  res.json(resultado);
}
