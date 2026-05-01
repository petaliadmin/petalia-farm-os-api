import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { BillingService } from "./billing.service";
import { PlanCode } from "./entities/plan.entity";
import { PaymentProviderName } from "./entities/payment-intent.entity";

class SubscribeDto {
  planCode: PlanCode;
  periodicite?: "mensuel" | "annuel";
  provider?: PaymentProviderName;
}

class ConfirmDto {
  notes?: string;
}

@ApiTags("Billing (Plans / Souscriptions)")
@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  // ── Public ───────────────────────────────────────────────────────────────

  @Get("plans")
  @ApiOperation({ summary: "Liste des plans publics (free/pro/enterprise)" })
  listPlans() {
    return this.billing.listPlans();
  }

  // ── Authentifié ──────────────────────────────────────────────────────────

  @Get("subscriptions/me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Souscription courante de l'organisation" })
  getMine(@TenantId() tenantId: string | null) {
    if (!tenantId) return null;
    return this.billing.getOrgSubscription(tenantId);
  }

  @Post("subscriptions/subscribe")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "directeur")
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Souscrire à un plan (gratuit = active, payant = pending_payment + intent)",
  })
  subscribe(@Body() body: SubscribeDto, @TenantId() tenantId: string | null) {
    if (!tenantId) {
      throw new Error("Organisation requise");
    }
    return this.billing.subscribe(
      tenantId,
      body.planCode,
      body.periodicite ?? "mensuel",
      body.provider ?? "manual",
    );
  }

  @Post("subscriptions/cancel")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "directeur")
  @ApiBearerAuth()
  cancel(@TenantId() tenantId: string | null) {
    if (!tenantId) throw new Error("Organisation requise");
    return this.billing.cancelSubscription(tenantId);
  }

  @Post("payment-intents/:id/confirm")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Confirme manuellement un paiement (admin Petalia uniquement)",
  })
  confirm(@Param("id") id: string, @Body() body: ConfirmDto) {
    return this.billing.confirmPayment(id, body.notes);
  }
}
