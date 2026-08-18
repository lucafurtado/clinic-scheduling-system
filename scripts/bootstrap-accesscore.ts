/**
 * Registra, via a API já genérica do AccessCore (sem tocar no código dele),
 * as permissões e o papel que o Horizonte Saúde precisa para proteger suas
 * rotas administrativas. Idempotente — pode rodar de novo sem duplicar nada.
 *
 * Uso:
 *   ACCESSCORE_URL=http://localhost:8000/api/v1 \
 *   ACCESSCORE_ADMIN_EMAIL=admin@horizonte.dev \
 *   ACCESSCORE_ADMIN_PASSWORD=... \
 *   npx tsx scripts/bootstrap-accesscore.ts [--assign-user <uuid>]
 */
import 'dotenv/config';

const ACCESSCORE_URL = process.env.ACCESSCORE_URL ?? 'http://localhost:8000/api/v1';
const ADMIN_EMAIL = process.env.ACCESSCORE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ACCESSCORE_ADMIN_PASSWORD;

const PERMISSOES_NECESSARIAS = [
  {
    resource: 'profissionais',
    action: 'manage',
    description: 'Gerenciar profissionais de uma clínica (Horizonte Saúde)',
  },
  {
    resource: 'agendamentos',
    action: 'manage',
    description: 'Gerenciar agendamentos de uma clínica (Horizonte Saúde)',
  },
];

const NOME_ROLE = 'Clínica - Equipe';

type Permissao = { id: string; resource: string; action: string };
type Role = { id: string; name: string };

async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ACCESSCORE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} -> ${res.status}: ${await res.text()}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Defina ACCESSCORE_ADMIN_EMAIL e ACCESSCORE_ADMIN_PASSWORD.');
  }

  const loginRes = await fetch(`${ACCESSCORE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!loginRes.ok) throw new Error(`Login falhou: ${loginRes.status} ${await loginRes.text()}`);
  const { access_token: token } = (await loginRes.json()) as { access_token: string };

  const permissoesExistentes = await api<Permissao[]>('/permissions', token);
  const permissoesCriadas: Permissao[] = [];
  for (const p of PERMISSOES_NECESSARIAS) {
    const existente = permissoesExistentes.find(
      (e) => e.resource === p.resource && e.action === p.action,
    );
    if (existente) {
      permissoesCriadas.push(existente);
      console.log(`permissão já existia: ${p.resource}:${p.action}`);
      continue;
    }
    const criada = await api<Permissao>('/permissions', token, {
      method: 'POST',
      body: JSON.stringify(p),
    });
    permissoesCriadas.push(criada);
    console.log(`permissão criada: ${p.resource}:${p.action}`);
  }

  const rolesExistentes = await api<Role[]>('/roles', token);
  let role = rolesExistentes.find((r) => r.name === NOME_ROLE);
  if (!role) {
    role = await api<Role>('/roles', token, {
      method: 'POST',
      body: JSON.stringify({
        name: NOME_ROLE,
        description: 'Acesso à área administrativa de uma clínica no Horizonte Saúde',
      }),
    });
    console.log(`role criada: ${NOME_ROLE}`);
  } else {
    console.log(`role já existia: ${NOME_ROLE}`);
  }

  const permissoesDaRole = await api<Permissao[]>(`/roles/${role.id}/permissions`, token);
  for (const p of permissoesCriadas) {
    if (permissoesDaRole.some((existente) => existente.id === p.id)) continue;
    await api(`/roles/${role.id}/permissions`, token, {
      method: 'POST',
      body: JSON.stringify({ permission_id: p.id }),
    });
    console.log(`permissão ${p.resource}:${p.action} associada à role ${NOME_ROLE}`);
  }

  const assignIndex = process.argv.indexOf('--assign-user');
  const userId = assignIndex !== -1 ? process.argv[assignIndex + 1] : undefined;
  if (userId) {
    await api(`/users/${userId}/roles`, token, {
      method: 'POST',
      body: JSON.stringify({ role_id: role.id }),
    }).catch((err: Error) => {
      // já atribuída é esperado em reruns; qualquer outro erro deve propagar
      if (!err.message.includes('409') && !err.message.includes('400')) throw err;
      console.log(`role já estava atribuída ao usuário ${userId}`);
    });
    console.log(`role ${NOME_ROLE} atribuída ao usuário ${userId}`);
  }

  console.log('Bootstrap concluído.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
