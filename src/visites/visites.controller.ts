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
import { VisitesService } from "./visites.service";
import { CreateVisiteDto, UpdateVisiteDto } from "./dto/visites.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("Visites")
@Controller("visites")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class VisitesController {
  constructor(private visitesService: VisitesService) {}

  @Get()
  @ApiOperation({ summary: "Liste des visites" })
  findAll(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("technicianId") technicianId?: string,
    @Query("statut") statut?: string,
  ) {
    return this.visitesService.findAll({ page, limit, technicianId, statut });
  }

  @Get("recentes")
  @ApiOperation({ summary: "Visites récentes" })
  findRecentes(@Query("limit") limit: number = 5) {
    return this.visitesService.findRecentes(limit);
  }

  @Get("stats")
  @ApiOperation({ summary: "Statistiques des visites" })
  getStats(@Query("organisationId") organisationId?: string) {
    return this.visitesService.findStats(organisationId);
  }

  @Get("activite-semaine")
  @ApiOperation({ summary: "Activité de la semaine" })
  getActiviteSemaine() {
    return this.visitesService.getActiviteSemaine();
  }

  @Get(":id")
  @ApiOperation({ summary: "Visite par ID" })
  findOne(@Param("id") id: string) {
    return this.visitesService.findById(id);
  }

  @Post()
  @Roles("admin", "directeur", "superviseur", "technicien")
  @ApiOperation({ summary: "Créer une visite" })
  create(@Body() createDto: CreateVisiteDto) {
    return this.visitesService.create(createDto);
  }

  @Patch(":id")
  @Roles("admin", "directeur", "superviseur", "technicien")
  @ApiOperation({ summary: "Mettre à jour une visite" })
  update(@Param("id") id: string, @Body() updateDto: UpdateVisiteDto) {
    return this.visitesService.update(id, updateDto);
  }

  @Delete(":id")
  @Roles("admin", "directeur", "superviseur")
  @ApiOperation({ summary: "Supprimer une visite" })
  remove(@Param("id") id: string) {
    return this.visitesService.remove(id);
  }

  @Get("parcelle/:parcelleId")
  @ApiOperation({ summary: "Visites par parcelle" })
  findByParcelle(@Param("parcelleId") parcelleId: string) {
    return this.visitesService.findByParcelle(parcelleId);
  }

  @Post(":id/photos")
  @ApiOperation({ summary: "Upload photos de visite" })
  uploadPhotos(@Param("id") id: string, @Body() body: { photos: string[] }) {
    return this.visitesService.uploadPhotos(id, body.photos);
  }

  @Get(":id/rapport")
  @ApiOperation({ summary: "Générer rapport PDF de visite" })
  getRapport(@Param("id") id: string) {
    return this.visitesService.getRapport(id);
  }

  @Post(":id/rapport")
  @ApiOperation({ summary: "Générer rapport PDF de visite" })
  generateRapport(@Param("id") id: string) {
    return this.visitesService.generateRapport(id);
  }
}
