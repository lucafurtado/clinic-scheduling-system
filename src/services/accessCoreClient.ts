// Cliente fino para a API do AccessCore. Não duplica nenhuma lógica de auth/RBAC —
// só chama os endpoints já genéricos que o AccessCore expõe (login/refresh/logout,
// perfil e permissões efetivas do usuário autenticado).

const ACCESSCORE_URL = process.env.ACCESSCORE_URL ?? 'http://localhost:8000/api/v1';

export class AccessCoreError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'AccessCoreError';
  }
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface UsuarioAccessCore {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
}

async function chamar<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${ACCESSCORE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new AccessCoreError('Não foi possível contatar o serviço de autenticação.', 503);
  }

  if (!res.ok) {
    throw new AccessCoreError('Falha na autenticação.', res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const accessCoreClient = {
  login(email: string, password: string) {
    return chamar<TokenPair>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  refresh(refreshToken: string) {
    return chamar<TokenPair>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },

  logout(refreshToken: string) {
    return chamar<void>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },

  async meComPermissoes(accessToken: string) {
    const authHeader = { Authorization: `Bearer ${accessToken}` };
    const [usuario, permissoes] = await Promise.all([
      chamar<UsuarioAccessCore>('/users/me', { headers: authHeader }),
      chamar<string[]>('/users/me/permissions', { headers: authHeader }),
    ]);
    return { usuario, permissoes };
  },
};
