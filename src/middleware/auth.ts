import { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors';
import { prisma } from '../lib/prisma';
import { AccessCoreError, accessCoreClient } from '../services/accessCoreClient';

function extrairBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}

// Não decodifica o JWT localmente — pede ao próprio AccessCore para validar
// (assinatura, expiração, usuário ativo) e resolver as permissões efetivas,
// exatamente como o AccessCore já faz para o console dele mesmo. Isso evita
// duplicar a lógica de verificação de token e mantém as permissões sempre
// "ao vivo": revogar uma role no AccessCore já vale na próxima requisição
// aqui, sem esperar o access token expirar.
export async function autenticar(req: Request, res: Response, next: NextFunction) {
  const token = extrairBearerToken(req);
  if (!token) throw new UnauthorizedError('Token de acesso ausente.');

  try {
    const { usuario, permissoes } = await accessCoreClient.meComPermissoes(token);
    req.usuarioAutenticado = { id: usuario.id, email: usuario.email, permissoes };
    next();
  } catch (error) {
    if (error instanceof AccessCoreError) {
      throw new UnauthorizedError('Token de acesso inválido ou expirado.');
    }
    throw error;
  }
}

export function exigirPermissao(permissao: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuarioAutenticado?.permissoes.includes(permissao)) {
      throw new ForbiddenError('Você não tem permissão para executar esta ação.');
    }
    next();
  };
}

// Garante que o usuário autenticado no AccessCore é de fato membro *desta*
// clínica — a fronteira de tenant que o AccessCore não conhece e não precisa
// conhecer.
export async function exigirMembroDaClinica(req: Request, res: Response, next: NextFunction) {
  const membro = await prisma.membro.findUnique({
    where: {
      clinicaId_accessCoreUserId: {
        clinicaId: req.clinica!.id,
        accessCoreUserId: req.usuarioAutenticado!.id,
      },
    },
  });
  if (!membro) throw new ForbiddenError('Você não tem acesso a esta clínica.');
  next();
}
