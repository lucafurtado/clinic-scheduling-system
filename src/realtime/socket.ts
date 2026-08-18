import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';

let io: Server | null = null;

function salaProfissional(clinicaSlug: string, profissionalId: number) {
  return `clinica:${clinicaSlug}:profissional:${profissionalId}`;
}

// Só é chamado no bootstrap real (src/server.ts), nunca nos testes — lá `io`
// fica null e as chamadas de notificarDatasAtualizadas viram no-op, sem
// precisar mockar nada para a suíte passar.
export function iniciarSocket(httpServer: HttpServer) {
  io = new Server(httpServer);

  io.on('connection', (socket: Socket) => {
    socket.on('entrar', (payload: { clinicaSlug?: string; profissionalId?: number }) => {
      if (!payload?.clinicaSlug || !payload.profissionalId) return;
      socket.join(salaProfissional(payload.clinicaSlug, payload.profissionalId));
    });
  });

  return io;
}

// Sala por clínica+profissional (não um broadcast geral): um cliente só recebe
// eventos do profissional que está de fato olhando, e nunca de outra clínica —
// mantém o mesmo isolamento de tenant da Fase 7 também no tempo real.
export function notificarDatasAtualizadas(clinicaSlug: string, profissionalId: number) {
  io?.to(salaProfissional(clinicaSlug, profissionalId)).emit('datas:atualizadas', {
    profissionalId,
  });
}
