import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from "@nestjs/swagger";
import type { Response } from "express";
import { ExportsService } from "./exports.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TenantId } from "../common/decorators/tenant-id.decorator";

@ApiTags("Exports")
@Controller("exports")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExportsController {
  constructor(private exportsService: ExportsService) {}

  @Get("parcelles")
  @ApiOperation({ summary: "Export parcelles (geojson, kml, shp)" })
  @ApiQuery({ name: "format", enum: ["geojson", "kml", "shp"] })
  async exportParcelles(
    @Query("format") format: "geojson" | "kml" | "shp" = "geojson",
    @TenantId() tenantId: string | null,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.exportsService.exportParcelles(format, tenantId);
    const filename = `parcelles_${new Date().toISOString().slice(0, 10)}.${result.extension}`;
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(result.body);
  }
}
