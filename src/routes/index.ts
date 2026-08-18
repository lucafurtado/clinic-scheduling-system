import { Router } from 'express';
import { resolveClinica } from '../middleware/resolveClinica';
import { adminRouter } from './admin.routes';
import { agendamentosRouter } from './agendamentos.routes';
import { authRouter } from './auth.routes';
import { profissionaisRouter } from './profissionais.routes';

export const apiRouter = Router();

const clinicaRouter = Router({ mergeParams: true });
clinicaRouter.use(resolveClinica);
clinicaRouter.use(profissionaisRouter);
clinicaRouter.use(agendamentosRouter);
clinicaRouter.use('/auth', authRouter);
clinicaRouter.use('/admin', adminRouter);

apiRouter.use('/clinicas/:clinicaSlug', clinicaRouter);
