import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as agendamentosController from '../controllers/agendamentos.controller';

export const agendamentosRouter = Router({ mergeParams: true });

// Desligado em teste para não sofrer 429 espúrio por volume de requisições da suíte
// (mesma armadilha documentada no AccessCore: rate limiter + testes em sequência rápida).
if (process.env.NODE_ENV !== 'test') {
  agendamentosRouter.use(
    '/agendamentos',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 20,
      standardHeaders: true,
      legacyHeaders: false,
      message: { erro: 'Muitas tentativas. Tente novamente em instantes.' },
    }),
  );
}

agendamentosRouter.post('/agendamentos', agendamentosController.criar);
agendamentosRouter.get('/agendamentos/:cpf', agendamentosController.buscarPorCpf);
agendamentosRouter.delete('/agendamentos/:id', agendamentosController.cancelar);
