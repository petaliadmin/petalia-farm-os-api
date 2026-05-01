import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { ApiTags, ApiHeader, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { ApiKeyGuard } from "./guards/api-key.guard";
import { QuotaGuard } from "./guards/quota.guard";
import { RequireScopes } from "./decorators/scopes.decorator";
import { PartnerService } from "./partner.service";
import { SkipTenantScope } from "../common/decorators/skip-tenant-scope.decorator";

@ApiTags("Partner B2B")
@Controller("partner")
@UseGuards(ApiKeyGuard, QuotaGuard)
@SkipTenantScope() // tenant resolved from API key, not JWT
@ApiHeader({
  name: "X-API-Key",
  description: "Clé API au format pk_... (ou Authorization: Bearer pk_...)",
  required: true,
})
export class PartnerController {
  constructor(private readonly partner: PartnerService) {}

  @Get("parcelles/aggregated")
  @RequireScopes("parcelles:read")
  @ApiOperation({
    summary:
      "Statistiques agrégées parcelles de l'organisation (count + superficie par région & culture)",
  })
  @ApiQuery({
    name: "bbox",
    required: false,
    description: "Filtre minLng,minLat,maxLng,maxLat",
  })
  parcelles(@Req() req: Request, @Query("bbox") bbox: string | undefined) {
    return this.partner.parcellesAggregated(req.partner!.organisationId, bbox);
  }

  @Get("ndvi/aggregate")
  @RequireScopes("ndvi:read")
  @ApiOperation({
    summary: "NDVI moyen par région sur les N derniers jours (1-90)",
  })
  @ApiQuery({ name: "days", required: false })
  ndvi(@Req() req: Request, @Query("days") days: string | undefined) {
    const d = Math.min(Math.max(parseInt(days ?? "30", 10) || 30, 1), 90);
    return this.partner.ndviAggregate(req.partner!.organisationId, d);
  }

  @Get("market/latest")
  @RequireScopes("market:read")
  @ApiOperation({ summary: "Dernier prix par marché pour une culture" })
  @ApiQuery({ name: "culture", required: true })
  market(@Query("culture") culture: string) {
    return this.partner.marketLatest(culture);
  }
}
