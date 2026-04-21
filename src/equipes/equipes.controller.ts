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
import { EquipesService } from "./equipes.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("Équipes")
@Controller("equipes")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EquipesController {
  constructor(private equipesService: EquipesService) {}

  @Get()
  findAll(
    @Query("organisationId") organisationId?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.equipesService.findAll({
      organisationId,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.equipesService.findById(id);
  }

  @Post()
  @Roles("admin", "directeur", "superviseur")
  create(@Body() data: any) {
    return this.equipesService.create(data);
  }

  @Patch(":id")
  @Roles("admin", "directeur", "superviseur")
  update(@Param("id") id: string, @Body() data: any) {
    return this.equipesService.update(id, data);
  }

  @Delete(":id")
  @Roles("admin", "directeur")
  remove(@Param("id") id: string) {
    return this.equipesService.remove(id);
  }

  @Get(":id/membres")
  getMembres(@Param("id") id: string) {
    return this.equipesService.getMembres(id);
  }
}
