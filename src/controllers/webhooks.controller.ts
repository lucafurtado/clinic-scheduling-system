import { Request, Response } from 'express';
import type Stripe from 'stripe';
import { pagamentosService } from '../services/pagamentos.service';
import { construirEventoWebhook } from '../services/stripeClient';

export async function stripeWebhook(req: Request, res: Response) {
  const assinatura = req.headers['stripe-signature'];
  if (typeof assinatura !== 'string') {
    res.status(400).json({ erro: 'Assinatura ausente.' });
    return;
  }

  let evento: Stripe.Event;
  try {
    // req.body precisa chegar aqui como Buffer cru (ver express.raw() na rota)
    // — a assinatura do Stripe é calculada sobre os bytes exatos enviados,
    // então um body já reformatado pelo express.json() invalidaria a checagem.
    evento = construirEventoWebhook(req.body as Buffer, assinatura);
  } catch {
    res.status(400).json({ erro: 'Assinatura inválida.' });
    return;
  }

  switch (evento.type) {
    case 'checkout.session.completed': {
      const session = evento.data.object as Stripe.Checkout.Session;
      await pagamentosService.confirmarPagamento(session.id);
      break;
    }
    case 'checkout.session.expired': {
      const session = evento.data.object as Stripe.Checkout.Session;
      await pagamentosService.cancelarPorFalhaPagamento(session.id);
      break;
    }
    default:
      break;
  }

  res.status(200).json({ received: true });
}
