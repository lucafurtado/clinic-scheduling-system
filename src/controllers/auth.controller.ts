import { Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors';
import { prisma } from '../lib/prisma';
import { loginSchema } from '../schemas/auth.schema';
import { AccessCoreError, accessCoreClient } from '../services/accessCoreClient';

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

// O cookie do refresh token é escopado por clínica (path inclui o slug) para
// que um mesmo navegador possa manter sessões independentes em clínicas
// diferentes — sem isso, logar na clínica B sobrescreveria a sessão da A.
function opcoesCookie(clinicaSlug: string) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: `/clinicas/${clinicaSlug}/auth`,
    maxAge: SETE_DIAS_MS,
  };
}

function nomeCookie(clinicaSlug: string) {
  return `hs_refresh_${clinicaSlug}`;
}

export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);
  const clinica = req.clinica!;

  let tokens;
  try {
    tokens = await accessCoreClient.login(email, password);
  } catch (error) {
    // Só um 401 do AccessCore significa "credenciais erradas" de fato — outros
    // status (503 sem conseguir contatar, 429 rate limit, 500 etc.) não são
    // culpa do usuário e não devem ser disfarçados de "senha inválida".
    if (error instanceof AccessCoreError && error.statusCode === 401) {
      throw new UnauthorizedError('E-mail ou senha inválidos.');
    }
    throw error;
  }

  const { usuario, permissoes } = await accessCoreClient.meComPermissoes(tokens.access_token);

  const membro = await prisma.membro.findUnique({
    where: { clinicaId_accessCoreUserId: { clinicaId: clinica.id, accessCoreUserId: usuario.id } },
  });
  if (!membro) throw new ForbiddenError('Você não tem acesso a esta clínica.');

  res.cookie(nomeCookie(clinica.slug), tokens.refresh_token, opcoesCookie(clinica.slug));
  res.json({
    access_token: tokens.access_token,
    expires_in: tokens.expires_in,
    usuario: { id: usuario.id, email: usuario.email, permissoes },
  });
}

export async function refresh(req: Request, res: Response) {
  const clinica = req.clinica!;
  const refreshToken = req.cookies?.[nomeCookie(clinica.slug)];
  if (!refreshToken) throw new UnauthorizedError('Sessão ausente ou expirada.');

  let tokens;
  try {
    tokens = await accessCoreClient.refresh(refreshToken);
  } catch (error) {
    if (error instanceof AccessCoreError && error.statusCode === 401) {
      throw new UnauthorizedError('Sessão inválida ou expirada.');
    }
    throw error;
  }

  res.cookie(nomeCookie(clinica.slug), tokens.refresh_token, opcoesCookie(clinica.slug));
  res.json({ access_token: tokens.access_token, expires_in: tokens.expires_in });
}

export async function logout(req: Request, res: Response) {
  const clinica = req.clinica!;
  const refreshToken = req.cookies?.[nomeCookie(clinica.slug)];
  if (refreshToken) {
    await accessCoreClient.logout(refreshToken).catch(() => undefined);
  }
  res.clearCookie(nomeCookie(clinica.slug), { path: `/clinicas/${clinica.slug}/auth` });
  res.status(204).send();
}
