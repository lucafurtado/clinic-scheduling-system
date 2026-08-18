import { Router } from 'express';
import * as agendamentosController from '../controllers/agendamentos.controller';
import * as profissionaisController from '../controllers/profissionais.controller';
import { autenticar, exigirMembroDaClinica, exigirPermissao } from '../middleware/auth';

export const adminRouter = Router({ mergeParams: true });

// Toda rota administrativa exige: token válido no AccessCore + ser membro
// desta clínica. A permissão específica de cada ação é checada por rota.
adminRouter.use(autenticar, exigirMembroDaClinica);

adminRouter.post(
  '/profissionais',
  exigirPermissao('profissionais:manage'),
  profissionaisController.criar,
);

adminRouter.delete(
  '/agendamentos/:id',
  exigirPermissao('agendamentos:manage'),
  agendamentosController.cancelarComoEquipe,
);
