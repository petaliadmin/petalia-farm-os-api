import { Injectable } from "@nestjs/common";
import {
  PaymentProvider,
  PaymentInitResult,
} from "./payment-provider.interface";
import { PaymentIntent } from "../entities/payment-intent.entity";

/**
 * Manual / out-of-band payment. Used until a real provider contract is
 * signed. Returns instructions; a Petalia admin confirms reception via
 * POST /payment-intents/:id/confirm.
 */
@Injectable()
export class ManualPaymentProvider extends PaymentProvider {
  readonly name = "manual" as const;

  async initialize(intent: PaymentIntent): Promise<PaymentInitResult> {
    return {
      providerRef: `MANUAL-${intent.id.slice(0, 8).toUpperCase()}`,
      instructions:
        `Paiement de ${intent.montantFcfa.toLocaleString("fr-FR")} FCFA — ` +
        `mention "PETALIA-${intent.id.slice(0, 8).toUpperCase()}" sur le virement. ` +
        `Un administrateur confirmera la souscription après réception.`,
    };
  }

  verifyWebhook(): boolean {
    return false; // pas de webhook entrant pour 'manual'
  }
}
