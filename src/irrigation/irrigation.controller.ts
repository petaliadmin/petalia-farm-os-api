import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { IrrigationService } from "./irrigation.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TenantId } from "../common/decorators/tenant-id.decorator";

@ApiTags("Irrigation")
@Controller("irrigation")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class IrrigationController {
  constructor(private irrigation: IrrigationService) {}

  @Get("recommandation/:parcelleId")
  @ApiOperation({
    summary: "Recommandation hydrique journalière (FAO-56 simplifié)",
  })
  recommandation(
    @Param("parcelleId") parcelleId: string,
    @TenantId() tenantId: string | null,
  ) {
    return this.irrigation.recommandationParcelle(parcelleId, tenantId);
  }
}
