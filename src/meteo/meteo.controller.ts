import { Controller, Get, Query, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { MeteoService } from "./meteo.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("Météo")
@Controller("meteo")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MeteoController {
  constructor(private meteoService: MeteoService) {}

  @Get()
  getByCoordinates(@Query("lat") lat: number, @Query("lng") lng: number) {
    return this.meteoService.getByCoordinates(lat, lng);
  }

  @Get(":ville")
  getByVille(@Param("ville") ville: string) {
    return this.meteoService.getByVille(ville);
  }

  @Get("previsions/:ville")
  getPrevisions(@Param("ville") ville: string) {
    return this.meteoService.getPrevisions(ville);
  }
}
