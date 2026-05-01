import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { OrganisationsService } from "./organisations.service";
import {
  CreateOrganisationDto,
  UpdateOrganisationDto,
} from "./dto/organisations.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("Organisations")
@Controller("organisations")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrganisationsController {
  constructor(private organisationsService: OrganisationsService) {}

  @Post()
  @Roles("admin")
  @ApiOperation({ summary: "Créer une organisation (onboarding)" })
  create(@Body() dto: CreateOrganisationDto) {
    return this.organisationsService.create(dto);
  }

  @Get()
  @Roles("admin", "directeur")
  @ApiOperation({ summary: "Lister toutes les organisations actives" })
  findAll(@Query("pays") pays?: string) {
    return this.organisationsService.findAll(pays);
  }

  @Get(":id")
  @Roles("admin", "directeur")
  @ApiOperation({ summary: "Détail d'une organisation" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.organisationsService.findById(id);
  }

  @Get(":id/dashboard")
  @Roles("admin", "directeur")
  @ApiOperation({ summary: "Tableau de bord de l'organisation" })
  getDashboard(@Param("id", ParseUUIDPipe) id: string) {
    return this.organisationsService.getDashboard(id);
  }

  @Patch(":id")
  @Roles("admin", "directeur")
  @ApiOperation({ summary: "Mettre à jour une organisation" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganisationDto,
  ) {
    return this.organisationsService.update(id, dto);
  }
}
