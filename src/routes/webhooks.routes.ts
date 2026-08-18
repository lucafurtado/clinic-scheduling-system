import express, { Router } from 'express';
import * as webhooksController from '../controllers/webhooks.controller';

export const webhooksRouter = Router();

// express.raw (não express.json) é obrigatório aqui — ver comentário no controller.
webhooksRouter.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  webhooksController.stripeWebhook,
);
