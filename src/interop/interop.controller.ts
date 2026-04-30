import { Controller, Get, Post, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
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

  @Post("assurance/indemnisation/webhook")
  indemnisationWebhook(@Body() data: any) {
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
