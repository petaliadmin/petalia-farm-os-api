import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiAcceptedResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  Client,
  PublicApiController,
  RequestId,
  Scopes,
} from "../auth/decorators";
import { PublicClient } from "../common/context";
import {
  CreateCropCycleDto,
  CreateParcelDto,
  ListCropCyclesQueryDto,
  ListParcelsQueryDto,
  UpdateCropCycleDto,
  UpdateParcelDto,
} from "../dto/parcels.dto";
import { JobsService } from "../jobs/jobs.service";
import { ParcelsService } from "../parcels/parcels.service";

@ApiTags("Parcelles")
@Controller("v1/parcels")
@PublicApiController()
export class ParcelsController {
  constructor(
    private readonly parcels: ParcelsService,
    private readonly jobs: JobsService,
  ) {}

  @Post()
  @Scopes("parcels:write")
  @ApiOperation({
    summary:
      "Créer une parcelle à partir d'un polygone GeoJSON (surface calculée en ha)",
  })
  create(
    @Client() client: PublicClient,
    @Body() dto: CreateParcelDto,
    @RequestId() rid: string,
  ) {
    return this.parcels.create(client, dto, rid);
  }

  @Get()
  @Scopes("parcels:read")
  @ApiOperation({
    summary:
      "Lister les parcelles (filtres géo bbox / near+radius / intersects)",
    description: "format=geojson renvoie une FeatureCollection.",
  })
  list(
    @Client() client: PublicClient,
    @Query() query: ListParcelsQueryDto,
    @RequestId() rid: string,
  ) {
    return this.parcels.list(client, query, rid);
  }

  @Get(":id")
  @Scopes("parcels:read")
  retrieve(
    @Client() client: PublicClient,
    @Param("id") id: string,
    @RequestId() rid: string,
  ) {
    return this.parcels.retrieve(client, id, rid);
  }

  @Patch(":id")
  @Scopes("parcels:write")
  update(
    @Client() client: PublicClient,
    @Param("id") id: string,
    @Body() dto: UpdateParcelDto,
    @RequestId() rid: string,
  ) {
    return this.parcels.update(client, id, dto, rid);
  }

  @Post(":id/ndvi_analyses")
  @Scopes("parcels:read")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Lancer une analyse NDVI Sentinel-2 (asynchrone)" })
  @ApiAcceptedResponse({
    description:
      "Job créé : suivre via GET /v1/jobs/{id} ou le webhook job.succeeded",
  })
  ndvi(@Client() client: PublicClient, @Param("id") id: string) {
    return this.jobs.startNdvi(client, id);
  }
}

@ApiTags("Cycles de culture")
@Controller("v1/crop_cycles")
@PublicApiController()
export class CropCyclesController {
  constructor(private readonly parcels: ParcelsService) {}

  @Post()
  @Scopes("parcels:write")
  create(
    @Client() client: PublicClient,
    @Body() dto: CreateCropCycleDto,
    @RequestId() rid: string,
  ) {
    return this.parcels.createCycle(client, dto, rid);
  }

  @Get()
  @Scopes("parcels:read")
  list(
    @Client() client: PublicClient,
    @Query() query: ListCropCyclesQueryDto,
    @RequestId() rid: string,
  ) {
    return this.parcels.listCycles(client, query, rid);
  }

  @Get(":id")
  @Scopes("parcels:read")
  retrieve(
    @Client() client: PublicClient,
    @Param("id") id: string,
    @RequestId() rid: string,
  ) {
    return this.parcels.retrieveCycle(client, id, rid);
  }

  @Patch(":id")
  @Scopes("parcels:write")
  update(
    @Client() client: PublicClient,
    @Param("id") id: string,
    @Body() dto: UpdateCropCycleDto,
    @RequestId() rid: string,
  ) {
    return this.parcels.updateCycle(client, id, dto, rid);
  }
}
