import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiHeader, ApiOperation } from "@nestjs/swagger";
import { InteropService } from "./interop.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("Interop")
@Controller("interop")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class InteropController {
  constructor(private interopService: InteropService) {}

  @Get("banque/score-credit/:nationalId")
  @Roles("admin", "directeur", "partenaire")
  @ApiOperation({ summary: "Score crédit agriculteur pour banques partenaires" })
  getScoreCredit(@Param("nationalId") nationalId: string) {
    return this.interopService.getScoreCredit(nationalId);
  }

  @Get("banque/recoltes/:nationalId")
  @Roles("admin", "directeur", "partenaire")
  getRecoltesCertifiees(@Param("nationalId") nationalId: string) {
    return this.interopService.getRecoltesCertifiees(nationalId);
  }

  @Get("banque/agriculteur/:nationalId")
  @Roles("admin", "directeur", "partenaire")
  getAgriculteur(@Param("nationalId") nationalId: string) {
    return this.interopService.getAgriculteur(nationalId);
  }

  @Post("banque/credit/notification")
  @Roles("admin", "directeur", "partenaire")
  creditNotification(@Body() data: any) {
    return this.interopService.creditNotification(data);
  }

  @Get("assurance/index-ndvi")
  @Roles("admin", "directeur", "partenaire")
  getIndexNdvi(@Param("indexId") indexId: string) {
    return this.interopService.getIndexNdvi(indexId);
  }

  @Post("assurance/sinistre")
  @Roles("admin", "directeur", "partenaire")
  declareSinistre(@Body() data: any) {
    return this.interopService.declareSinistre(data);
  }

  /**
   * Webhook appelé par le partenaire assurance après validation d'indemnisation.
   * Authentifié par HMAC-SHA256 dans le header X-Insurance-Signature.
   * Ce endpoint est volontairement hors JWT (appelé par un système tiers).
   */
  @Post("assurance/indemnisation/webhook")
  @UseGuards() // Override class-level guards — no JWT for inbound webhooks
  @ApiHeader({
    name: "X-Insurance-Signature",
    description: "sha256=<HMAC-SHA256 du body avec INSURANCE_WEBHOOK_SECRET>",
    required: true,
  })
  @ApiOperation({
    summary: "Webhook indemnisation assurance (authentifié par HMAC)",
  })
  indemnisationWebhook(
    @Headers("x-insurance-signature") sig: string,
    @Body() data: any,
  ) {
    this.interopService.validateInsuranceSignature(sig, JSON.stringify(data));
    return this.interopService.indemnisationWebhook(data);
  }

  @Get("etat/statistiques")
  @Roles("admin", "directeur", "partenaire")
  getStatistiques() {
    return this.interopService.getStatistiques();
  }

  @Get("etat/production-region/:region")
  @Roles("admin", "directeur", "partenaire")
  getProductionRegion(@Param("region") region: string) {
    return this.interopService.getProductionRegion(region);
  }

  @Post("etat/declaration-campagne")
  @Roles("admin", "directeur", "partenaire")
  declarationCampagne(@Body() data: any) {
    return this.interopService.declarationCampagne(data);
  }
}
