import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();

  // Sem ALLOWED_ORIGINS configurada, CORS fica fechado: frontend e backend são
  // servidos na mesma origem hoje, então nenhum request same-origin precisa de CORS
  // liberado. Isso substitui o `cors()` totalmente aberto que existia antes.
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.use(cors({ origin: allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : false }));

  app.use(express.json());
  app.use(express.static(path.join(process.cwd(), '.')));

  // Desligado em teste para não sofrer 429 espúrio por volume de requisições da suíte
  // (mesma armadilha documentada no AccessCore: rate limiter + testes em sequência rápida).
  if (process.env.NODE_ENV !== 'test') {
    app.use(
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

  app.use(apiRouter);

  app.use(errorHandler);

  return app;
}

export const app = createApp();
