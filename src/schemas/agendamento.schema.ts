import { z } from 'zod';

const MENSAGEM_CAMPOS_OBRIGATORIOS = 'Preencha todos os campos obrigatórios.';

const cpfSchema = z
  .string(MENSAGEM_CAMPOS_OBRIGATORIOS)
  .min(1, MENSAGEM_CAMPOS_OBRIGATORIOS)
  .transform((valor) => valor.replace(/\D/g, ''))
  .pipe(z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos, com ou sem formatação.'));

export const criarAgendamentoSchema = z.object({
  nome: z.string(MENSAGEM_CAMPOS_OBRIGATORIOS).trim().min(1, MENSAGEM_CAMPOS_OBRIGATORIOS),
  cpf: cpfSchema,
  telefone: z.string(MENSAGEM_CAMPOS_OBRIGATORIOS).trim().min(1, MENSAGEM_CAMPOS_OBRIGATORIOS),
  profissionalId: z.coerce
    .number(MENSAGEM_CAMPOS_OBRIGATORIOS)
    .int()
    .positive(MENSAGEM_CAMPOS_OBRIGATORIOS),
  dataConsulta: z
    .string(MENSAGEM_CAMPOS_OBRIGATORIOS)
    .regex(/^\d{4}-\d{2}-\d{2}$/, MENSAGEM_CAMPOS_OBRIGATORIOS),
});

export type CriarAgendamentoInput = z.infer<typeof criarAgendamentoSchema>;

export const cancelarAgendamentoBodySchema = z.object({
  cpf: cpfSchema,
});

export const agendamentoIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const cpfParamSchema = z.object({
  cpf: z.string().min(1),
});
