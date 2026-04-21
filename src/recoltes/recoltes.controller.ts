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
import { RecoltesService } from "./recoltes.service";
import { CreateRecolteDto, UpdateRecolteDto } from "./dto/recoltes.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("Recoltes")
@Controller("recoltes")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RecoltesController {
  constructor(private recoltesService: RecoltesService) {}

  @Get()
  findAll(
    @Query("parcelleId") parcelleId?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.recoltesService.findAll({
      parcelleId,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.recoltesService.findById(id);
  }

  @Post()
  @Roles("admin", "directeur", "superviseur", "technicien")
  create(@Body() createDto: CreateRecolteDto) {
    return this.recoltesService.create(createDto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() updateDto: UpdateRecolteDto) {
    return this.recoltesService.update(id, updateDto);
  }

  @Delete(":id")
  @Roles("admin", "directeur", "superviseur")
  remove(@Param("id") id: string) {
    return this.recoltesService.remove(id);
  }

  @Get("parcelle/:parcelleId")
  findByParcelle(@Param("parcelleId") parcelleId: string) {
    return this.recoltesService.findByParcelle(parcelleId);
  }

  @Post(":id/valider")
  @Roles("admin", "directeur", "superviseur")
  valider(@Param("id") id: string) {
    return this.recoltesService.valider(id);
  }
}
