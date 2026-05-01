import { Controller, Get, Post, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { NdviService } from "./ndvi.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TenantId } from "../common/decorators/tenant-id.decorator";

@ApiTags("NDVI")
@Controller("ndvi")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NdviController {
  constructor(private ndviService: NdviService) {}

  @Get("parcelle/:parcelleId")
  getByParcelle(@Param("parcelleId") parcelleId: string) {
    return this.ndviService.getByParcelle(parcelleId);
  }

  @Get("parcelle/:parcelleId/latest")
  getLatest(@Param("parcelleId") parcelleId: string) {
    return this.ndviService.getLatest(parcelleId);
  }

  @Post("parcelle/:parcelleId/fetch")
  @ApiOperation({ summary: "Trigger NDVI fetch from satellite (async)" })
  fetchNdvi(
    @Param("parcelleId") parcelleId: string,
    @TenantId() tenantId: string | null,
  ) {
    return this.ndviService.fetchNdvi(parcelleId, tenantId);
  }

  @Get("dashboard")
  getDashboard(@TenantId() tenantId: string | null) {
    return this.ndviService.getDashboard(tenantId);
  }
}
