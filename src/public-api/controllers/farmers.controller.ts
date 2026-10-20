import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  Client,
  PublicApiController,
  RequestId,
  Scopes,
} from "../auth/decorators";
import { PublicClient } from "../common/context";
import { ListQueryDto } from "../common/pagination";
import { ConsentsService } from "../consents/consents.service";
import {
  CreateFarmDto,
  CreateFarmerDto,
  ListFarmersQueryDto,
  ListFarmsQueryDto,
  UpdateFarmDto,
  UpdateFarmerDto,
} from "../dto/farmers.dto";
import { FarmersService } from "../farmers/farmers.service";

@ApiTags("Producteurs")
@Controller("v1/farmers")
@PublicApiController()
export class FarmersController {
  constructor(
    private readonly farmers: FarmersService,
    private readonly consents: ConsentsService,
  ) {}

  @Post()
  @Scopes("farmers:write")
  @ApiOperation({
    summary: "Inscrire un producteur (identité = numéro de téléphone)",
    description:
      "Votre organisation devient sa délégataire. Si le numéro est déjà inscrit ailleurs : 409, demandez un consentement.",
  })
  create(
    @Client() client: PublicClient,
    @Body() dto: CreateFarmerDto,
    @RequestId() rid: string,
  ) {
    return this.farmers.create(client, dto, rid);
  }

  @Get()
  @Scopes("farmers:read")
  @ApiOperation({ summary: "Lister les producteurs gérés ou ayant consenti" })
  list(
    @Client() client: PublicClient,
    @Query() query: ListFarmersQueryDto,
    @RequestId() rid: string,
  ) {
    return this.farmers.list(client, query, rid);
  }

  @Get(":id")
  @Scopes("farmers:read")
  retrieve(
    @Client() client: PublicClient,
    @Param("id") id: string,
    @RequestId() rid: string,
  ) {
    return this.farmers.retrieve(client, id, rid);
  }

  @Patch(":id")
  @Scopes("farmers:write")
  update(
    @Client() client: PublicClient,
    @Param("id") id: string,
    @Body() dto: UpdateFarmerDto,
    @RequestId() rid: string,
  ) {
    return this.farmers.update(client, id, dto, rid);
  }

  @Get(":id/access_logs")
  @Scopes("farmers:read")
  @ApiOperation({
    summary: "Journal « qui a lu mes données » du producteur",
    description:
      "Réservé à l'organisation délégataire, pour le restituer au producteur.",
  })
  accessLogs(
    @Client() client: PublicClient,
    @Param("id") id: string,
    @Query() query: ListQueryDto,
  ) {
    return this.consents.accessLogs(client, id, query);
  }
}

@ApiTags("Exploitations")
@Controller("v1/farms")
@PublicApiController()
export class FarmsController {
  constructor(private readonly farmers: FarmersService) {}

  @Post()
  @Scopes("farmers:write")
  create(
    @Client() client: PublicClient,
    @Body() dto: CreateFarmDto,
    @RequestId() rid: string,
  ) {
    return this.farmers.createFarm(client, dto, rid);
  }

  @Get()
  @Scopes("farmers:read")
  list(
    @Client() client: PublicClient,
    @Query() query: ListFarmsQueryDto,
    @RequestId() rid: string,
  ) {
    return this.farmers.listFarms(client, query, rid);
  }

  @Get(":id")
  @Scopes("farmers:read")
  retrieve(
    @Client() client: PublicClient,
    @Param("id") id: string,
    @RequestId() rid: string,
  ) {
    return this.farmers.retrieveFarm(client, id, rid);
  }

  @Patch(":id")
  @Scopes("farmers:write")
  update(
    @Client() client: PublicClient,
    @Param("id") id: string,
    @Body() dto: UpdateFarmDto,
    @RequestId() rid: string,
  ) {
    return this.farmers.updateFarm(client, id, dto, rid);
  }
}
