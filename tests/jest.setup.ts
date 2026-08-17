// Roda antes de qualquer módulo do app ser importado, garantindo que a suíte
// nunca escreva no mesmo banco usado por `npm run dev` — foi exatamente essa
// mistura que truncou os dados de desenvolvimento na primeira versão disto.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://horizonte:horizonte@localhost:5432/horizonte_saude_test';
