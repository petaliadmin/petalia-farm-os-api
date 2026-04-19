import { Controller, Get, Post, Body, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { RapportsService } from "./rapports.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("Rapports")
@Controller("rapports")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RapportsController {
  constructor(private rapportsService: RapportsService) {}

  @Get("kpis")
  getKpis(@Query("periode") periode: "semaine" | "mois" | "saison" = "mois") {
    return this.rapportsService.getKpis(periode);
  }

  @Get("graphiques")
  getGraphiques() {
    return this.rapportsService.getGraphiques();
  }

  @Post("export")
  @Roles("admin", "directeur", "superviseur")
  exportRapport(
    @Body() data: { format: string; type: string; periode: string },
  ) {
    return this.rapportsService.exportRapport(data);
  }

  @Get("economiques")
  @Roles("admin", "directeur", "superviseur")
  getEconomiques() {
    return this.rapportsService.getEconomiques();
  }
}
