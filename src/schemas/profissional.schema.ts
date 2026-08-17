import { z } from 'zod';

export const listarProfissionaisQuerySchema = z.object({
  especialidade: z.string().trim().min(1).optional(),
});

export const profissionalIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
