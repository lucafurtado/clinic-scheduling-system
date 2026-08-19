import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// Sem prefixo de clínica de propósito — é o endpoint que a plataforma de deploy
// (Render) chama periodicamente para decidir se a instância está saudável,
// não uma rota de negócio. Checa o banco (não só "o processo está de pé"):
// um servidor no ar mas sem conseguir falar com o Postgres não está saudável.
export async function healthCheck(req: Request, res: Response) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', uptimeSeconds: Math.floor(process.uptime()) });
  } catch (error) {
    req.log.error(error, 'health check falhou: banco inacessível');
    res.status(503).json({ status: 'erro', erro: 'Banco de dados inacessível.' });
  }
}
