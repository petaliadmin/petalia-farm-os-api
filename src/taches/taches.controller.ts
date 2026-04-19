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
import { TachesService } from "./taches.service";
import { CreateTacheDto, UpdateTacheDto } from "./dto/taches.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("Taches")
@Controller("taches")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TachesController {
  constructor(private tachesService: TachesService) {}

  @Get()
  findAll(
    @Query("statut") statut?: string,
    @Query("assigneeId") assigneeId?: string,
  ) {
    return this.tachesService.findAll({ statut, assigneeId });
  }

  @Get("stats")
  getStats() {
    return this.tachesService.getStats();
  }

  @Get("urgentes")
  findUrgentes() {
    return this.tachesService.findUrgentes();
  }

  @Get("kanban")
  getKanban() {
    return this.tachesService.getKanban();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.tachesService.findById(id);
  }

  @Post()
  @Roles("admin", "directeur", "superviseur", "technicien")
  create(@Body() createDto: CreateTacheDto) {
    return this.tachesService.create(createDto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() updateDto: UpdateTacheDto) {
    return this.tachesService.update(id, updateDto);
  }

  @Patch(":id/statut")
  updateStatut(@Param("id") id: string, @Body("statut") statut: string) {
    return this.tachesService.updateStatut(id, statut);
  }

  @Delete(":id")
  @Roles("admin", "directeur", "superviseur")
  remove(@Param("id") id: string) {
    return this.tachesService.remove(id);
  }
}
