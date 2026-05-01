import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { AnalyticsService } from "./analytics.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TenantId } from "../common/decorators/tenant-id.decorator";

@ApiTags("Analytics")
@Controller("analytics")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Get("rendements/timeseries")
  @ApiOperation({ summary: "Séries temporelles de rendement par culture" })
  @ApiQuery({ name: "granularity", enum: ["month", "week", "year"] })
  @ApiQuery({ name: "culture", required: false })
  rendementsTimeseries(
    @Query("granularity") granularity: "month" | "week" | "year" = "month",
    @Query("culture") culture: string | undefined,
    @TenantId() tenantId: string | null,
  ) {
    return this.analytics.rendementsTimeseries(granularity, tenantId, culture);
  }

  @Get("tendances/cultures")
  @ApiOperation({
    summary: "Tendance 12 mois courant vs 12 mois précédent par culture",
  })
  tendanceCultures(@TenantId() tenantId: string | null) {
    return this.analytics.tendanceCultures(tenantId);
  }

  @Get("marges/parcelles")
  @ApiOperation({ summary: "Marge brute et ROI par parcelle (12 derniers mois)" })
  margesParcelles(
    @Query("limit") limit: string | undefined,
    @TenantId() tenantId: string | null,
  ) {
    const n = Math.min(Math.max(parseInt(limit ?? "50", 10) || 50, 1), 500);
    return this.analytics.margesParParcelle(tenantId, n);
  }

  @Get("campagnes/compare")
  @ApiOperation({ summary: "Comparaison de deux campagnes (A vs B)" })
  compareCampagnes(
    @Query("a") a: string,
    @Query("b") b: string,
    @TenantId() tenantId: string | null,
  ) {
    return this.analytics.compareCampagnes(a, b, tenantId);
  }
}
