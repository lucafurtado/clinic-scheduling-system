import http from 'http';
import { app } from './app';
import { iniciarSocket } from './realtime/socket';

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  const httpServer = http.createServer(app);
  iniciarSocket(httpServer);
  httpServer.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
}

export default app;
