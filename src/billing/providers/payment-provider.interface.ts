import { PaymentIntent } from "../entities/payment-intent.entity";

export interface PaymentInitResult {
  providerRef: string;
  redirectUrl?: string;
  instructions?: string;
  rawPayload?: object;
}

/**
 * Abstract payment provider. Real integrations (Wave, Orange Money, Stripe)
 * implement this interface. The 'manual' implementation is the default —
 * an admin marks the intent as paid through /payment-intents/:id/confirm.
 */
export abstract class PaymentProvider {
  abstract readonly name: "manual" | "wave" | "orange_money" | "stripe";
  abstract initialize(intent: PaymentIntent): Promise<PaymentInitResult>;
  abstract verifyWebhook(rawBody: string, signature: string): boolean;
}
