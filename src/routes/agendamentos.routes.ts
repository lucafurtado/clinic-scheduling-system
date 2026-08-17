import { Router } from 'express';
import * as agendamentosController from '../controllers/agendamentos.controller';

export const agendamentosRouter = Router();

agendamentosRouter.post('/agendamentos', agendamentosController.criar);
agendamentosRouter.get('/agendamentos/:cpf', agendamentosController.buscarPorCpf);
agendamentosRouter.delete('/agendamentos/:id', agendamentosController.cancelar);
