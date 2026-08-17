import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ erro: err.message });
  }

  if (err instanceof ZodError) {
    const mensagem = err.issues[0]?.message ?? 'Dados inválidos.';
    return res.status(400).json({ erro: mensagem });
  }

  console.error(err);
  return res.status(500).json({ erro: 'Erro interno do servidor.' });
}
