import { Injectable } from "@nestjs/common";
import { ServiceUnavailableException } from "@nestjs/common";
import { PaymentProvider, PaymentInitResult } from "./payment-provider.interface";
import { PaymentIntent } from "../entities/payment-intent.entity";

/**
 * Stub Wave Money. À implémenter avec API Wave Business :
 *  - POST /v1/checkout/sessions  → providerRef + redirectUrl
 *  - Webhook X-Signature HMAC SHA256 (Wave-Webhook-Secret)
 */
@Injectable()
export class WavePaymentProviderStub extends PaymentProvider {
  readonly name = "wave" as const;

  async initialize(_intent: PaymentIntent): Promise<PaymentInitResult> {
    throw new ServiceUnavailableException(
      "Provider Wave non encore configuré (stub) — utiliser provider 'manual'",
    );
  }

  verifyWebhook(): boolean {
    return false;
  }
}
