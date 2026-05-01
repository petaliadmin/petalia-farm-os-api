import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { BenchmarksService } from "./benchmarks.service";
import { BenchmarkRendement } from "./entities/benchmark-rendement.entity";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { SkipTenantScope } from "../common/decorators/skip-tenant-scope.decorator";

@ApiTags("Benchmarks")
@Controller("benchmarks")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BenchmarksController {
  constructor(private benchmarksService: BenchmarksService) {}

  @Get()
  @SkipTenantScope()
  @ApiOperation({ summary: "Référentiels rendement (ISRA, public)" })
  findAll(
    @Query("culture") culture?: string,
    @Query("zone") zoneAgroecologique?: string,
  ) {
    return this.benchmarksService.findAll({ culture, zoneAgroecologique });
  }

  @Get("compare/:parcelleId")
  @ApiOperation({
    summary: "Comparaison rendement parcelle vs benchmark ISRA",
  })
  compare(
    @Param("parcelleId") parcelleId: string,
    @TenantId() tenantId: string | null,
  ) {
    return this.benchmarksService.compareParcelle(parcelleId, tenantId);
  }

  @Get(":id")
  @SkipTenantScope()
  findOne(@Param("id") id: string) {
    return this.benchmarksService.findOne(id);
  }

  @Post()
  @Roles("admin")
  @SkipTenantScope()
  create(@Body() data: Partial<BenchmarkRendement>) {
    return this.benchmarksService.create(data);
  }

  @Patch(":id")
  @Roles("admin")
  @SkipTenantScope()
  update(@Param("id") id: string, @Body() data: Partial<BenchmarkRendement>) {
    return this.benchmarksService.update(id, data);
  }

  @Delete(":id")
  @Roles("admin")
  @SkipTenantScope()
  remove(@Param("id") id: string) {
    return this.benchmarksService.remove(id);
  }
}
