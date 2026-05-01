import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Plan, PlanCode } from "./entities/plan.entity";
import {
  Subscription,
  SubscriptionStatus,
} from "./entities/subscription.entity";
import {
  PaymentIntent,
  PaymentProviderName,
} from "./entities/payment-intent.entity";
import { ManualPaymentProvider } from "./providers/manual.provider";
import { WavePaymentProviderStub } from "./providers/wave.provider.stub";
import { OrangeMoneyPaymentProviderStub } from "./providers/orange-money.provider.stub";
import { PaymentProvider } from "./providers/payment-provider.interface";

@Injectable()
export class BillingService implements OnModuleInit {
  private readonly logger = new Logger(BillingService.name);
  private readonly providers: Record<PaymentProviderName, PaymentProvider>;

  constructor(
    @InjectRepository(Plan) private planRepo: Repository<Plan>,
    @InjectRepository(Subscription)
    private subRepo: Repository<Subscription>,
    @InjectRepository(PaymentIntent)
    private intentRepo: Repository<PaymentIntent>,
    private manual: ManualPaymentProvider,
    private wave: WavePaymentProviderStub,
    private orange: OrangeMoneyPaymentProviderStub,
  ) {
    this.providers = {
      manual: this.manual,
      wave: this.wave,
      orange_money: this.orange,
      stripe: this.manual, // pas implémenté → fallback explicite manual
    };
  }

  async onModuleInit(): Promise<void> {
    await this.seedDefaultPlans();
  }

  // ── Plans ────────────────────────────────────────────────────────────────

  listPlans(): Promise<Plan[]> {
    return this.planRepo.find({
      where: { actif: true },
      order: { prixMensuelFcfa: "ASC" },
    });
  }

  async getPlanByCode(code: PlanCode): Promise<Plan> {
    const plan = await this.planRepo.findOne({ where: { code } });
    if (!plan) throw new NotFoundException(`Plan '${code}' introuvable`);
    return plan;
  }

  // ── Subscriptions ────────────────────────────────────────────────────────

  async getOrgSubscription(organisationId: string): Promise<Subscription | null> {
    return this.subRepo.findOne({ where: { organisationId } });
  }

  /**
   * Crée ou met à jour la souscription de l'organisation. Si le plan est
   * gratuit, statut = active immédiatement. Sinon = pending_payment et
   * un PaymentIntent est créé.
   */
  async subscribe(
    organisationId: string,
    planCode: PlanCode,
    periodicite: "mensuel" | "annuel",
    provider: PaymentProviderName,
  ): Promise<{
    subscription: Subscription;
    paymentIntent: PaymentIntent | null;
    paymentInit: { providerRef: string; instructions?: string; redirectUrl?: string } | null;
  }> {
    const plan = await this.getPlanByCode(planCode);
    const isFree = plan.prixMensuelFcfa === 0 && plan.prixAnnuelFcfa === 0;

    const now = new Date();
    const periodEndsAt = new Date(now);
    if (periodicite === "annuel") {
      periodEndsAt.setFullYear(periodEndsAt.getFullYear() + 1);
    } else {
      periodEndsAt.setMonth(periodEndsAt.getMonth() + 1);
    }

    const existing = await this.subRepo.findOne({ where: { organisationId } });
    const status: SubscriptionStatus = isFree ? "active" : "pending_payment";

    let subscription: Subscription;
    if (existing) {
      await this.subRepo.update(existing.id, {
        planId: plan.id,
        planCode: plan.code,
        status,
        periodicite,
        periodStartedAt: now,
        periodEndsAt,
      });
      subscription = (await this.subRepo.findOne({
        where: { id: existing.id },
      })) as Subscription;
    } else {
      subscription = await this.subRepo.save(
        this.subRepo.create({
          organisationId,
          planId: plan.id,
          planCode: plan.code,
          status,
          periodicite,
          periodStartedAt: now,
          periodEndsAt,
          autoRenew: false,
        }),
      );
    }

    if (isFree) {
      return { subscription, paymentIntent: null, paymentInit: null };
    }

    const montant =
      periodicite === "annuel" ? plan.prixAnnuelFcfa : plan.prixMensuelFcfa;
    const intent = await this.intentRepo.save(
      this.intentRepo.create({
        organisationId,
        subscriptionId: subscription.id,
        montantFcfa: montant,
        provider,
        status: "pending",
      }),
    );

    const init = await this.providers[provider].initialize(intent);
    await this.intentRepo.update(intent.id, {
      providerRef: init.providerRef,
      providerPayload: init.rawPayload,
      status: "processing",
    });
    const intentSaved = (await this.intentRepo.findOne({
      where: { id: intent.id },
    })) as PaymentIntent;

    return {
      subscription,
      paymentIntent: intentSaved,
      paymentInit: {
        providerRef: init.providerRef,
        instructions: init.instructions,
        redirectUrl: init.redirectUrl,
      },
    };
  }

  /**
   * Confirme un paiement (admin ou webhook). Active la souscription liée.
   */
  async confirmPayment(intentId: string, notes?: string): Promise<PaymentIntent> {
    const intent = await this.intentRepo.findOne({ where: { id: intentId } });
    if (!intent) throw new NotFoundException("PaymentIntent introuvable");
    if (intent.status === "succeeded") return intent;
    if (intent.status === "failed" || intent.status === "expired") {
      throw new BadRequestException(
        `Impossible de confirmer un intent en statut ${intent.status}`,
      );
    }
    await this.intentRepo.update(intent.id, {
      status: "succeeded",
      paidAt: new Date(),
      notes: notes ?? intent.notes,
    });
    await this.subRepo.update(intent.subscriptionId, { status: "active" });
    this.logger.log(
      `PaymentIntent ${intent.id} confirmé → subscription ${intent.subscriptionId} active`,
    );
    return (await this.intentRepo.findOne({
      where: { id: intent.id },
    })) as PaymentIntent;
  }

  async cancelSubscription(organisationId: string): Promise<Subscription> {
    const sub = await this.subRepo.findOne({ where: { organisationId } });
    if (!sub) throw new NotFoundException("Aucune souscription");
    await this.subRepo.update(sub.id, {
      status: "cancelled",
      cancelledAt: new Date(),
      autoRenew: false,
    });
    return (await this.subRepo.findOne({ where: { id: sub.id } })) as Subscription;
  }

  // ── Helpers consommés par PlanLimitGuard ─────────────────────────────────

  async getActivePlanForOrg(organisationId: string): Promise<Plan> {
    const sub = await this.subRepo.findOne({ where: { organisationId } });
    if (!sub || (sub.status !== "active" && sub.status !== "trial")) {
      // Pas de souscription active → plan free implicite
      return this.getPlanByCode("free");
    }
    return this.getPlanByCode(sub.planCode as PlanCode);
  }

  // ── Seed plans par défaut au démarrage ──────────────────────────────────

  private async seedDefaultPlans(): Promise<void> {
    const defaults: Partial<Plan>[] = [
      {
        code: "free",
        nom: "Free",
        prixMensuelFcfa: 0,
        prixAnnuelFcfa: 0,
        maxParcelles: 5,
        maxUtilisateurs: 2,
        maxDiagnosticsParMois: 10,
        maxAppelsApiParMois: 0,
        ndviInclus: false,
        whatsappInclus: false,
        exportSigInclus: false,
        diagnosticIaInclus: true,
      },
      {
        code: "pro",
        nom: "Pro",
        prixMensuelFcfa: 25_000,
        prixAnnuelFcfa: 250_000,
        maxParcelles: 100,
        maxUtilisateurs: 10,
        maxDiagnosticsParMois: 200,
        maxAppelsApiParMois: 10_000,
        ndviInclus: true,
        whatsappInclus: true,
        exportSigInclus: true,
        diagnosticIaInclus: true,
      },
      {
        code: "enterprise",
        nom: "Enterprise",
        prixMensuelFcfa: 150_000,
        prixAnnuelFcfa: 1_500_000,
        maxParcelles: null as unknown as number,
        maxUtilisateurs: null as unknown as number,
        maxDiagnosticsParMois: null as unknown as number,
        maxAppelsApiParMois: null as unknown as number,
        ndviInclus: true,
        whatsappInclus: true,
        exportSigInclus: true,
        diagnosticIaInclus: true,
      },
    ];
    for (const def of defaults) {
      const exists = await this.planRepo.findOne({
        where: { code: def.code as PlanCode },
      });
      if (!exists) {
        await this.planRepo.save(this.planRepo.create(def));
        this.logger.log(`Plan seed inséré: ${def.code}`);
      }
    }
  }
}
