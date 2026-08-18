import pino from 'pino';

// Pretty-print legível em dev/teste; JSON estruturado (uma linha por evento,
// pronto para um agregador de logs) em produção — é o formato que a Railway
// (e qualquer plataforma que colete stdout) espera.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
});
