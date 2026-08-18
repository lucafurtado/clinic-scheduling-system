import { Request, Response } from 'express';
import {
  criarProfissionalSchema,
  listarProfissionaisQuerySchema,
  profissionalIdParamSchema,
} from '../schemas/profissional.schema';
import { profissionaisService } from '../services/profissionais.service';

export async function listarEspecialidades(req: Request, res: Response) {
  const especialidades = await profissionaisService.listarEspecialidades(req.clinica!.id);
  res.json(especialidades);
}

export async function listarProfissionais(req: Request, res: Response) {
  const { especialidade } = listarProfissionaisQuerySchema.parse(req.query);
  const profissionais = await profissionaisService.listarProfissionais(
    req.clinica!.id,
    especialidade,
  );
  res.json(profissionais);
}

export async function listarDatasDisponiveis(req: Request, res: Response) {
  const { id } = profissionalIdParamSchema.parse(req.params);
  const datas = await profissionaisService.listarDatasDisponiveis(req.clinica!.id, id);
  res.json(datas);
}

export async function criar(req: Request, res: Response) {
  const dados = criarProfissionalSchema.parse(req.body);
  const profissional = await profissionaisService.criar(req.clinica!.id, dados);
  res.status(201).json(profissional);
}
