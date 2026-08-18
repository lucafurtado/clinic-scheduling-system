import Stripe from 'stripe';

const VALOR_RESERVA_CENTAVOS = 5000; // R$ 50,00 — taxa de reserva, modo sandbox

let stripeInstance: Stripe | null = null;

// Instanciado sob demanda (não no import) para não quebrar `npm test`/build
// em ambientes sem STRIPE_SECRET_KEY configurada — só falha quando alguém
// de fato tenta criar uma cobrança.
function stripe(): Stripe {
  if (!stripeInstance) {
    const chave = process.env.STRIPE_SECRET_KEY;
    if (!chave) throw new Error('STRIPE_SECRET_KEY não configurada.');
    stripeInstance = new Stripe(chave);
  }
  return stripeInstance;
}

export interface DadosCheckout {
  agendamentoId: number;
  clinicaSlug: string;
  descricao: string;
  emailPaciente?: string;
}

export async function criarSessaoCheckout(dados: DadosCheckout) {
  const baseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000';

  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'brl',
          product_data: { name: `Reserva de consulta — ${dados.descricao}` },
          unit_amount: VALOR_RESERVA_CENTAVOS,
        },
        quantity: 1,
      },
    ],
    customer_email: dados.emailPaciente,
    metadata: {
      agendamentoId: String(dados.agendamentoId),
      clinicaSlug: dados.clinicaSlug,
    },
    // Curto de propósito: é uma reserva de horário, não faz sentido segurar a
    // vaga por muito tempo esperando um pagamento que pode nunca vir.
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    success_url: `${baseUrl}/?pagamento=sucesso&clinica=${dados.clinicaSlug}`,
    cancel_url: `${baseUrl}/?pagamento=cancelado&clinica=${dados.clinicaSlug}`,
  });

  return { sessionId: session.id, checkoutUrl: session.url, valorCentavos: VALOR_RESERVA_CENTAVOS };
}

export function construirEventoWebhook(payloadCru: Buffer, assinatura: string): Stripe.Event {
  const segredo = process.env.STRIPE_WEBHOOK_SECRET;
  if (!segredo) throw new Error('STRIPE_WEBHOOK_SECRET não configurada.');
  return stripe().webhooks.constructEvent(payloadCru, assinatura, segredo);
}
