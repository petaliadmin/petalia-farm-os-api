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
import { CampagnesService } from "./campagnes.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("Campagnes")
@Controller("campagnes")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CampagnesController {
  constructor(private campagnesService: CampagnesService) {}

  @Get()
  findAll(@Query("organisationId") organisationId?: string) {
    return this.campagnesService.findAll(organisationId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.campagnesService.findById(id);
  }

  @Post()
  @Roles("admin", "directeur", "superviseur")
  create(@Body() data: any) {
    return this.campagnesService.create(data);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() data: any) {
    return this.campagnesService.update(id, data);
  }

  @Post(":id/cloture")
  @Roles("admin", "directeur", "superviseur")
  cloture(@Param("id") id: string, @Body() data: any) {
    return this.campagnesService.cloture(id, data);
  }

  @Post(":id/activer")
  @Roles("admin", "directeur", "superviseur")
  activer(@Param("id") id: string) {
    return this.campagnesService.activer(id);
  }

  @Get(":id/taches")
  getTaches(@Param("id") id: string) {
    return this.campagnesService.getTaches(id);
  }

  @Post(":id/taches/generer")
  @Roles("admin", "directeur", "superviseur")
  generateTaches(@Param("id") id: string) {
    return this.campagnesService.generateTaches(id);
  }

  @Get("parcelle/:parcelleId")
  findByParcelle(@Param("parcelleId") parcelleId: string) {
    return this.campagnesService.findByParcelle(parcelleId);
  }

  @Delete(":id")
  @Roles("admin")
  remove(@Param("id") id: string) {
    return this.campagnesService.remove(id);
  }
}
