import 'dotenv/config';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'path';
import pinoHttp from 'pino-http';
import { logger } from './lib/logger';
import { healthCheck } from './controllers/health.controller';
import { errorHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';
import { webhooksRouter } from './routes/webhooks.routes';

export function createApp() {
  const app = express();

  // Atrás de 1 proxy reverso em produção (o Render termina TLS e encaminha por
  // HTTP) — sem isso, req.ip e req.secure refletem o proxy, não o cliente real,
  // o que quebra a IP-detection do rate limiter. Inofensivo localmente (sem
  // proxy na frente, não há X-Forwarded-* para "confiar" de qualquer forma).
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // CSP desligada de propósito: o front-end atual (index.html) depende de
      // <script> inline e de atributos onclick="..." — o CSP default do helmet
      // bloqueia ambos e quebraria a aplicação inteira. Mover esse script para
      // um arquivo externo e habilitar uma CSP com nonce é uma melhoria futura
      // de frontend, fora do escopo deste hardening. As demais proteções do
      // helmet (X-Content-Type-Options, X-Frame-Options, HSTS etc.) seguem ativas.
      contentSecurityPolicy: false,
    }),
  );
  app.use(pinoHttp({ logger }));

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

  app.get('/health', healthCheck);

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
