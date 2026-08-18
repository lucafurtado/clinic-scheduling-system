import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors';
import { AccessCoreError } from '../services/accessCoreClient';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ erro: err.message });
  }

  if (err instanceof ZodError) {
    const mensagem = err.issues[0]?.message ?? 'Dados inválidos.';
    return res.status(400).json({ erro: mensagem });
  }

  // Chega aqui só quando não é um 401 de credenciais (esse já foi tratado no
  // controller) — ex.: AccessCore fora do ar, rate limit, erro 5xx dele.
  if (err instanceof AccessCoreError) {
    req.log.error(err);
    return res
      .status(502)
      .json({ erro: 'Serviço de autenticação indisponível. Tente novamente em instantes.' });
  }

  req.log.error(err);
  return res.status(500).json({ erro: 'Erro interno do servidor.' });
}
