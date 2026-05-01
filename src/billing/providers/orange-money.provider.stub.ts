import { Injectable } from "@nestjs/common";
import { ServiceUnavailableException } from "@nestjs/common";
import {
  PaymentProvider,
  PaymentInitResult,
} from "./payment-provider.interface";
import { PaymentIntent } from "../entities/payment-intent.entity";

/**
 * Stub Orange Money. À implémenter avec API OM Web Payment :
 *  - POST /webpayment  → pay_token + payment_url
 *  - Polling /transactionstatus ou notif_url
 */
@Injectable()
export class OrangeMoneyPaymentProviderStub extends PaymentProvider {
  readonly name = "orange_money" as const;

  async initialize(_intent: PaymentIntent): Promise<PaymentInitResult> {
    throw new ServiceUnavailableException(
      "Provider Orange Money non encore configuré (stub) — utiliser provider 'manual'",
    );
  }

  verifyWebhook(): boolean {
    return false;
  }
}
