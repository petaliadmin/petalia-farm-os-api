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
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { IntrantsService } from "./intrants.service";
import {
  CreateIntrantDto,
  UpdateIntrantDto,
  CreateMouvementDto,
} from "./dto/intrants.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("Intrants")
@Controller("intrants")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class IntrantsController {
  constructor(private intrantsService: IntrantsService) {}

  @Get()
  findAll(
    @Query("organisationId") organisationId?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.intrantsService.findAll({
      organisationId,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get("stats")
  getStats(@Query("organisationId") organisationId?: string) {
    return this.intrantsService.getStats(organisationId);
  }

  @Get("consommation")
  getConsommation() {
    return this.intrantsService.getConsommation();
  }

  @Get("alertes")
  getAlertes() {
    return this.intrantsService.getAlertes();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.intrantsService.findById(id);
  }

  @Post()
  @Roles("admin", "directeur", "superviseur")
  create(@Body() createDto: CreateIntrantDto) {
    return this.intrantsService.create(createDto);
  }

  @Patch(":id")
  @Roles("admin", "directeur", "superviseur")
  update(@Param("id") id: string, @Body() updateDto: UpdateIntrantDto) {
    return this.intrantsService.update(id, updateDto);
  }

  @Delete(":id")
  @Roles("admin", "directeur")
  remove(@Param("id") id: string) {
    return this.intrantsService.remove(id);
  }

  @Post(":id/mouvements")
  @Roles("admin", "directeur", "superviseur", "technicien")
  createMouvement(
    @Param("id") id: string,
    @Body() createDto: CreateMouvementDto,
  ) {
    return this.intrantsService.createMouvement(id, createDto);
  }

  @Get(":id/mouvements")
  getMouvements(@Param("id") id: string) {
    return this.intrantsService.getMouvements(id);
  }
}
