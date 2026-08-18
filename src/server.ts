import http from 'http';
import { app } from './app';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { iniciarSocket } from './realtime/socket';

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  const httpServer = http.createServer(app);
  iniciarSocket(httpServer);
  httpServer.listen(PORT, () => logger.info(`Servidor rodando na porta ${PORT}`));

  // Railway (e a maioria das plataformas de deploy) manda SIGTERM antes de
  // matar o processo em cada redeploy/restart — sem isso, requisições em voo
  // e conexões de Socket.io são derrubadas abruptamente em vez de encerradas
  // com folga, e a conexão com o Postgres fica pendurada.
  const desligar = (sinal: string) => {
    logger.info(`${sinal} recebido, encerrando graciosamente...`);
    httpServer.close(() => {
      prisma
        .$disconnect()
        .catch((error) => logger.error(error, 'erro ao desconectar do banco'))
        .finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => desligar('SIGTERM'));
  process.on('SIGINT', () => desligar('SIGINT'));
}

export default app;
