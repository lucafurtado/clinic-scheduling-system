import { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '../errors';
import { clinicasRepository } from '../repositories/clinicas.repository';

export async function resolveClinica(req: Request, res: Response, next: NextFunction) {
  const clinica = await clinicasRepository.buscarPorSlug(String(req.params.clinicaSlug));
  if (!clinica) throw new NotFoundError('Clínica não encontrada.');

  req.clinica = clinica;
  next();
}
