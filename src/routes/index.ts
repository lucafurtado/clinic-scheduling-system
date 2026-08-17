import { Router } from 'express';
import { agendamentosRouter } from './agendamentos.routes';
import { profissionaisRouter } from './profissionais.routes';

export const apiRouter = Router();

apiRouter.use(profissionaisRouter);
apiRouter.use(agendamentosRouter);
