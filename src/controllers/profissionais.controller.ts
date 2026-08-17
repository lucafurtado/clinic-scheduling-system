import { Request, Response } from 'express';
import {
  listarProfissionaisQuerySchema,
  profissionalIdParamSchema,
} from '../schemas/profissional.schema';
import { profissionaisService } from '../services/profissionais.service';

export async function listarEspecialidades(req: Request, res: Response) {
  const especialidades = await profissionaisService.listarEspecialidades();
  res.json(especialidades);
}

export async function listarProfissionais(req: Request, res: Response) {
  const { especialidade } = listarProfissionaisQuerySchema.parse(req.query);
  const profissionais = await profissionaisService.listarProfissionais(especialidade);
  res.json(profissionais);
}

export async function listarDatasDisponiveis(req: Request, res: Response) {
  const { id } = profissionalIdParamSchema.parse(req.params);
  const datas = await profissionaisService.listarDatasDisponiveis(id);
  res.json(datas);
}
