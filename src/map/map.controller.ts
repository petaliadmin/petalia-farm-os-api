import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
} from "@nestjs/swagger";
import { MapService } from "./map.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TenantId } from "../common/decorators/tenant-id.decorator";

@ApiTags("Map (Cartographie)")
@Controller("map")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MapController {
  constructor(private readonly map: MapService) {}

  @Get("parcelles.geojson")
  @ApiOperation({
    summary: "Parcelles en GeoJSON FeatureCollection (Polygons + statut color)",
  })
  @ApiQuery({
    name: "bbox",
    required: false,
    description: "minLng,minLat,maxLng,maxLat (clip serveur)",
  })
  @ApiOkResponse({
    description: "FeatureCollection de polygones (boundary) avec couleurs",
  })
  parcellesGeoJson(
    @Query("bbox") bbox: string | undefined,
    @TenantId() tenantId: string | null,
  ) {
    return this.map.parcellesGeoJson(bbox, tenantId);
  }

  @Get("clusters")
  @ApiOperation({
    summary:
      "Clusters serveur (grille degrés) — Points avec count + AVG healthScore",
  })
  @ApiQuery({ name: "bbox", required: false })
  @ApiQuery({
    name: "gridSize",
    required: false,
    description: "Précision (4–200). 8 ≈ pays, 50 ≈ commune",
  })
  clusters(
    @Query("bbox") bbox: string | undefined,
    @Query("gridSize") gridSize: string | undefined,
    @TenantId() tenantId: string | null,
  ) {
    const g = parseInt(gridSize ?? "10", 10) || 10;
    return this.map.clusters(bbox, tenantId, g);
  }

  @Get("ndvi-heatmap")
  @ApiOperation({
    summary:
      "Heatmap NDVI 30j — Points par parcelle avec moyenne NDVI + couleur",
  })
  @ApiQuery({ name: "bbox", required: false })
  ndviHeatmap(
    @Query("bbox") bbox: string | undefined,
    @TenantId() tenantId: string | null,
  ) {
    return this.map.ndviHeatmap(bbox, tenantId);
  }
}
