import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { PlanLimitGuard } from "./guards/plan-limit.guard";
import { ManualPaymentProvider } from "./providers/manual.provider";
import { WavePaymentProviderStub } from "./providers/wave.provider.stub";
import { OrangeMoneyPaymentProviderStub } from "./providers/orange-money.provider.stub";
import { Plan } from "./entities/plan.entity";
import { Subscription } from "./entities/subscription.entity";
import { PaymentIntent } from "./entities/payment-intent.entity";
import { Parcelle } from "../parcelles/entities/parcelle.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Plan, Subscription, PaymentIntent, Parcelle]),
  ],
  controllers: [BillingController],
  providers: [
    BillingService,
    PlanLimitGuard,
    ManualPaymentProvider,
    WavePaymentProviderStub,
    OrangeMoneyPaymentProviderStub,
  ],
  exports: [BillingService, PlanLimitGuard],
})
export class BillingModule {}
