import 'dotenv/config';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';
import { webhooksRouter } from './routes/webhooks.routes';

export function createApp() {
  const app = express();

  // Sem ALLOWED_ORIGINS configurada, CORS fica fechado: frontend e backend são
  // servidos na mesma origem hoje, então nenhum request same-origin precisa de CORS
  // liberado. Isso substitui o `cors()` totalmente aberto que existia antes.
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : false,
      credentials: true,
    }),
  );

  // Precisa vir ANTES do express.json() global: a rota do Stripe usa
  // express.raw() própria, porque a verificação de assinatura do webhook
  // exige os bytes crus do corpo, não o JSON já reparseado.
  app.use('/webhooks', webhooksRouter);

  app.use(express.json());
  app.use(cookieParser());
  app.use(express.static(path.join(process.cwd(), '.')));

  app.use(apiRouter);

  app.use(errorHandler);

  return app;
}

export const app = createApp();
