import { Router } from 'express';
import * as profissionaisController from '../controllers/profissionais.controller';

export const profissionaisRouter = Router();

profissionaisRouter.get('/especialidades', profissionaisController.listarEspecialidades);
profissionaisRouter.get('/profissionais', profissionaisController.listarProfissionais);
profissionaisRouter.get('/profissionais/:id/datas', profissionaisController.listarDatasDisponiveis);
