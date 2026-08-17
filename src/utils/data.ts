/** Converte um Date (coluna `date` do Postgres) para 'YYYY-MM-DD', o formato usado em toda a API. */
export function formatarData(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/** Converte 'YYYY-MM-DD' para um Date em meia-noite UTC, pronto para gravar numa coluna `date`. */
export function parseData(dataISO: string): Date {
  return new Date(`${dataISO}T00:00:00.000Z`);
}
