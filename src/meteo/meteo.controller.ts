import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  ParseFloatPipe,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiQuery, ApiParam } from "@nestjs/swagger";
import { MeteoService } from "./meteo.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("Météo")
@Controller("meteo")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MeteoController {
  constructor(private meteoService: MeteoService) {}

  @Get()
  @ApiQuery({ name: "lat", type: Number })
  @ApiQuery({ name: "lng", type: Number })
  getByCoordinates(
    @Query("lat", ParseFloatPipe) lat: number,
    @Query("lng", ParseFloatPipe) lng: number,
  ) {
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new BadRequestException("Coordonnées hors plage");
    }
    return this.meteoService.getByCoordinates(lat, lng);
  }

  @Get(":ville")
  @ApiParam({ name: "ville" })
  getByVille(@Param("ville") ville: string) {
    return this.meteoService.getByVille(ville);
  }

  @Get("previsions/:ville")
  @ApiParam({ name: "ville" })
  getPrevisions(@Param("ville") ville: string) {
    return this.meteoService.getPrevisions(ville);
  }
}
