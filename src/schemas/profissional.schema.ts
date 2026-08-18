import { z } from 'zod';

export const listarProfissionaisQuerySchema = z.object({
  especialidade: z.string().trim().min(1).optional(),
});

export const profissionalIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const criarProfissionalSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do profissional.'),
  especialidade: z.string().trim().min(1, 'Informe a especialidade.'),
  datasDisponiveis: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datas devem estar no formato YYYY-MM-DD.'))
    .min(1, 'Informe ao menos uma data disponível.'),
});
