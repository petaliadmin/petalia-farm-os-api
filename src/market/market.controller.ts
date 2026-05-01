import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from "@nestjs/swagger";
import { MarketService } from "./market.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { MarketPrice } from "./entities/market-price.entity";

class IngestDto {
  rows: Partial<MarketPrice>[];
}

@ApiTags("Market (prix)")
@Controller("market")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MarketController {
  constructor(private readonly market: MarketService) {}

  @Post("prices")
  @UseGuards(RolesGuard)
  @Roles("admin", "directeur")
  @ApiOperation({ summary: "Ingest prix marché (batch)" })
  ingest(@Body() body: IngestDto) {
    return this.market.ingest(body.rows ?? []);
  }

  @Get("prices/timeseries")
  @ApiOperation({ summary: "Série historique prix" })
  @ApiQuery({ name: "culture", required: true })
  @ApiQuery({ name: "marche", required: true })
  @ApiQuery({ name: "days", required: false })
  timeseries(
    @Query("culture") culture: string,
    @Query("marche") marche: string,
    @Query("days") days: string | undefined,
  ) {
    const d = Math.min(Math.max(parseInt(days ?? "365", 10) || 365, 7), 1095);
    return this.market.timeseries(culture, marche, d);
  }

  @Get("prices/forecast")
  @ApiOperation({
    summary:
      "Prédiction prix marché — régression linéaire log + saisonnalité mensuelle (IC80%)",
  })
  @ApiQuery({ name: "culture", required: true })
  @ApiQuery({ name: "marche", required: true })
  @ApiQuery({
    name: "horizon",
    required: false,
    description: "Horizon en jours (1-90, défaut 30)",
  })
  forecast(
    @Query("culture") culture: string,
    @Query("marche") marche: string,
    @Query("horizon") horizon: string | undefined,
  ) {
    const h = Math.min(Math.max(parseInt(horizon ?? "30", 10) || 30, 1), 90);
    return this.market.forecast(culture, marche, h);
  }
}
