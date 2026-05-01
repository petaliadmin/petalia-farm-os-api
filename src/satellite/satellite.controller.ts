import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from "@nestjs/swagger";
import { SatelliteService } from "./satellite.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { SatelliteIndexCode } from "./entities/satellite-index.entity";
import { INDEX_CODES } from "./evalscripts";

class FetchIndexDto {
  indexCode: SatelliteIndexCode;
  from: string;
  to: string;
}

@ApiTags("Satellite (multi-indices)")
@Controller("satellite")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SatelliteController {
  constructor(private readonly satellite: SatelliteService) {}

  @Post("parcelle/:parcelleId/fetch")
  @ApiOperation({
    summary:
      "Calcule un indice Sentinel-2 (NDVI/EVI/SAVI/NDWI/LAI) sur une plage de dates et persiste",
  })
  fetch(
    @Param("parcelleId") parcelleId: string,
    @Body() body: FetchIndexDto,
    @TenantId() tenantId: string | null,
  ) {
    return this.satellite.fetchIndex(
      parcelleId,
      body.indexCode,
      body.from,
      body.to,
      tenantId,
    );
  }

  @Get("parcelle/:parcelleId")
  @ApiOperation({
    summary: "Liste les valeurs persistées + classification pour une parcelle",
  })
  @ApiQuery({
    name: "indices",
    required: false,
    description:
      "Liste séparée par virgules (ex: ndvi,evi,ndwi). Défaut: tous.",
  })
  list(
    @Param("parcelleId") parcelleId: string,
    @Query("indices") indices: string | undefined,
    @TenantId() tenantId: string | null,
  ) {
    const codes = (indices ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s): s is SatelliteIndexCode =>
        (INDEX_CODES as string[]).includes(s),
      );
    return this.satellite.listForParcelle(parcelleId, codes, tenantId);
  }
}
