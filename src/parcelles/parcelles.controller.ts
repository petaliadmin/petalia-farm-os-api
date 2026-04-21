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
import { ParcellesService } from "./parcelles.service";
import { CreateParcelleDto, UpdateParcelleDto } from "./dto/parcelles.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("Parcelles")
@Controller("parcelles")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ParcellesController {
  constructor(private parcellesService: ParcellesService) {}

  @Get()
  @ApiOperation({ summary: "Liste des parcelles" })
  findAll(
    @Query("organisationId") organisationId?: string,
    @Query("technicienId") technicienId?: string,
    @Query("statut") statut?: string,
    @Query("culture") culture?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.parcellesService.findAll({
      organisationId,
      technicienId,
      statut,
      culture,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get("stats")
  @ApiOperation({ summary: "Statistiques des parcelles" })
  getStats(@Query("organisationId") organisationId?: string) {
    return this.parcellesService.findStats(organisationId);
  }

  @Get("urgentes")
  @ApiOperation({ summary: "Parcelles nécessitant attention" })
  findUrgentes(@Query("organisationId") organisationId?: string) {
    return this.parcellesService.findUrgentes(organisationId);
  }

  @Get("carte")
  @ApiOperation({ summary: "GeoJSON FeatureCollection pour carte" })
  getGeoJSON() {
    return this.parcellesService.getGeoJSON();
  }

  @Get("nearby")
  @ApiOperation({ summary: "Parcelles à proximité" })
  findNearby(
    @Query("lat") lat: number,
    @Query("lng") lng: number,
    @Query("rayon") rayon: number = 5000,
  ) {
    return this.parcellesService.findNearby(lat, lng, rayon);
  }

  @Get(":id")
  @ApiOperation({ summary: "Parcelle par ID" })
  findOne(@Param("id") id: string) {
    return this.parcellesService.findById(id);
  }

  @Post()
  @Roles("admin", "directeur", "superviseur", "technicien")
  @ApiOperation({ summary: "Créer une parcelle" })
  create(@Body() createDto: CreateParcelleDto) {
    return this.parcellesService.create(createDto);
  }

  @Patch(":id")
  @Roles("admin", "directeur", "superviseur", "technicien")
  @ApiOperation({ summary: "Mettre à jour une parcelle" })
  update(@Param("id") id: string, @Body() updateDto: UpdateParcelleDto) {
    return this.parcellesService.update(id, updateDto);
  }

  @Delete(":id")
  @Roles("admin", "directeur", "superviseur")
  @ApiOperation({ summary: "Supprimer une parcelle (soft delete)" })
  remove(@Param("id") id: string) {
    return this.parcellesService.remove(id);
  }

  @Get(":id/visites")
  @ApiOperation({ summary: "Visites d'une parcelle" })
  getVisites(@Param("id") id: string) {
    return this.parcellesService.getVisites(id);
  }

  @Get(":id/taches")
  @ApiOperation({ summary: "Tâches d'une parcelle" })
  getTaches(@Param("id") id: string) {
    return this.parcellesService.getTaches(id);
  }

  @Get(":id/campagnes")
  @ApiOperation({ summary: "Campagnes d'une parcelle" })
  getCampagnes(@Param("id") id: string) {
    return this.parcellesService.getCampagnes(id);
  }

  @Get(":id/recoltes")
  @ApiOperation({ summary: "Récoltes d'une parcelle" })
  getRecoltes(@Param("id") id: string) {
    return this.parcellesService.getRecoltes(id);
  }

  @Get(":id/ndvi")
  @ApiOperation({ summary: "Données NDVI d'une parcelle" })
  getNdvi(@Param("id") id: string) {
    return this.parcellesService.getNdvi(id);
  }

  @Post(":id/poi")
  @ApiOperation({ summary: "Ajouter un point d'intérêt" })
  createPoi(@Param("id") id: string, @Body() data: any) {
    return this.parcellesService.createPoi(id, data);
  }

  @Get(":id/poi")
  @ApiOperation({ summary: "Points d'intérêt d'une parcelle" })
  getPois(@Param("id") id: string) {
    return this.parcellesService.getPois(id);
  }
}
