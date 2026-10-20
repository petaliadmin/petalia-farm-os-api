import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import {
  Client,
  PublicApiController,
  RequestId,
  Scopes,
} from "../auth/decorators";
import { PublicClient } from "../common/context";
import { ProblemException } from "../common/problem";
import {
  BatchObservationsDto,
  CreateDeviceDto,
  CreateObservationDto,
  ListDevicesQueryDto,
  ListObservationsQueryDto,
  UpdateDeviceDto,
} from "../dto/observations.dto";
import { ObservationsService } from "../observations/observations.service";

@ApiTags("Capteurs")
@Controller("v1/devices")
@PublicApiController()
export class DevicesController {
  constructor(private readonly service: ObservationsService) {}

  @Post()
  @Scopes("devices:write")
  @ApiOperation({
    summary: "Enregistrer un capteur, une passerelle, une station ou un drone",
  })
  create(@Client() client: PublicClient, @Body() dto: CreateDeviceDto) {
    return this.service.createDevice(client, dto);
  }

  @Get()
  @Scopes("devices:read")
  list(@Client() client: PublicClient, @Query() query: ListDevicesQueryDto) {
    return this.service.listDevices(client, query);
  }

  @Get(":id")
  @Scopes("devices:read")
  retrieve(@Client() client: PublicClient, @Param("id") id: string) {
    return this.service.retrieveDevice(client, id);
  }

  @Patch(":id")
  @Scopes("devices:write")
  update(
    @Client() client: PublicClient,
    @Param("id") id: string,
    @Body() dto: UpdateDeviceDto,
  ) {
    return this.service.updateDevice(client, id, dto);
  }

  @Post(":id/senml")
  @Scopes("observations:write")
  @ApiOperation({
    summary: "Ingérer un pack SenML (RFC 8428) pour ce capteur",
    description:
      "Les noms SenML sont les propriétés Petalia (soil_moisture…), unités SenML converties (Cel, %RH, /, m…).",
  })
  @ApiBody({
    schema: {
      type: "array",
      items: { type: "object" },
      example: [
        { bn: "urn:dev:deveui:A84041000181C2E1:", bt: 1792303200 },
        { n: "soil_moisture", u: "%", v: 23.4 },
        { n: "soil_temperature", u: "Cel", v: 27.1 },
      ],
    },
  })
  senml(
    @Client() client: PublicClient,
    @Param("id") id: string,
    @Body() records: unknown[],
    @RequestId() rid: string,
  ) {
    return this.service.ingestSenml(client, id, records, rid);
  }
}

@ApiTags("Observations")
@Controller("v1")
@PublicApiController()
export class ObservationsController {
  constructor(private readonly service: ObservationsService) {}

  @Post("observations")
  @Scopes("observations:write")
  @ApiOperation({
    summary: "Enregistrer une observation (unité explicite obligatoire)",
  })
  create(
    @Client() client: PublicClient,
    @Body() dto: CreateObservationDto,
    @RequestId() rid: string,
  ) {
    return this.service.createOne(client, dto, rid);
  }

  /**
   * AIP-136 custom method: POST /v1/observations:batch. Express 4 cannot
   * escape ":" in a path, so the suffix is captured and checked here.
   */
  @Post("observations:verb")
  @Scopes("observations:write")
  @ApiParam({ name: "verb", enum: [":batch"] })
  @ApiOperation({
    summary: "Envoi groupé (≤ 1000) — POST /v1/observations:batch",
    description:
      "Tout ou rien à la validation. Les renvois exacts d'une même mesure capteur sont ignorés (comptés dans duplicates).",
  })
  batch(
    @Client() client: PublicClient,
    @Param("verb") verb: string,
    @Body() dto: BatchObservationsDto,
    @RequestId() rid: string,
  ) {
    if (verb !== ":batch") {
      throw new ProblemException("route_missing", {
        params: { method: "POST", path: `/api/v1/observations${verb}` },
      });
    }
    return this.service.createBatch(client, dto.observations, rid);
  }

  @Get("observations/properties")
  @Scopes("observations:read")
  @ApiOperation({
    summary: "Vocabulaire des propriétés observables et de leurs unités",
  })
  properties() {
    return this.service.properties();
  }

  @Get("observations")
  @Scopes("observations:read")
  list(
    @Client() client: PublicClient,
    @Query() query: ListObservationsQueryDto,
    @RequestId() rid: string,
  ) {
    return this.service.list(client, query, rid);
  }

  @Get("observations/:id")
  @Scopes("observations:read")
  retrieve(
    @Client() client: PublicClient,
    @Param("id") id: string,
    @RequestId() rid: string,
  ) {
    return this.service.retrieve(client, id, rid);
  }
}
