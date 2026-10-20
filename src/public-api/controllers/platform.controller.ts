import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Request } from "express";
import { Repository } from "typeorm";
import { SkipTenantScope } from "../../common/decorators/skip-tenant-scope.decorator";
import { MeteoService } from "../../meteo/meteo.service";
import { Organisation } from "../../organisations/entities/organisation.entity";
import {
  AllowPublishableKey,
  Client,
  PublicApiController,
  RequestId,
  Scopes,
  TestModeOnly,
} from "../auth/decorators";
import { OAuthService } from "../auth/oauth.service";
import { PublicClient } from "../common/context";
import { encodeId } from "../common/ids";
import { ListQueryDto } from "../common/pagination";
import { presentOrganization } from "../common/presenters";
import { ProblemException } from "../common/problem";
import { ConsentsService } from "../consents/consents.service";
import {
  ConfirmConsentDto,
  CreateConsentDto,
  CreateNotificationDto,
  CreateWebhookEndpointDto,
  ListConsentsQueryDto,
  ListEventsQueryDto,
  OAuthTokenDto,
  SyncQueryDto,
  UpdateWebhookEndpointDto,
  WeatherQueryDto,
} from "../dto/platform.dto";
import { WebhooksService } from "../events/webhooks.service";
import { JobsService } from "../jobs/jobs.service";
import { NotificationsService } from "../notifications/notifications.service";
import { SandboxService } from "../sandbox/sandbox.service";
import { SyncService } from "../sync/sync.service";

@ApiTags("Consentements")
@Controller("v1/consents")
@PublicApiController()
export class ConsentsController {
  constructor(private readonly consents: ConsentsService) {}

  @Post()
  @Scopes("consents:write")
  @ApiOperation({
    summary: "Demander l'accès aux données d'un producteur",
    description:
      "Un code est envoyé par SMS au producteur avec votre nom et la finalité. Il vous le communique s'il accepte. En mode test, le code est renvoyé dans test_confirmation_code.",
  })
  create(@Client() client: PublicClient, @Body() dto: CreateConsentDto) {
    return this.consents.create(client, dto);
  }

  @Post(":id/confirm")
  @HttpCode(HttpStatus.OK)
  @Scopes("consents:write")
  @ApiOperation({ summary: "Confirmer avec le code reçu par le producteur" })
  confirm(
    @Client() client: PublicClient,
    @Param("id") id: string,
    @Body() dto: ConfirmConsentDto,
  ) {
    return this.consents.confirm(client, id, dto);
  }

  @Post(":id/revoke")
  @HttpCode(HttpStatus.OK)
  @Scopes("consents:write")
  @ApiOperation({
    summary: "Révoquer un consentement",
    description:
      "Possible par le bénéficiaire ou par l'organisation délégataire au nom du producteur.",
  })
  revoke(@Client() client: PublicClient, @Param("id") id: string) {
    return this.consents.revoke(client, id);
  }

  @Get()
  @Scopes("consents:read")
  list(@Client() client: PublicClient, @Query() query: ListConsentsQueryDto) {
    return this.consents.list(client, query);
  }

  @Get(":id")
  @Scopes("consents:read")
  retrieve(@Client() client: PublicClient, @Param("id") id: string) {
    return this.consents.retrieve(client, id);
  }
}

@ApiTags("Canaux")
@Controller("v1/notifications")
@PublicApiController()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post()
  @Scopes("notifications:write")
  @ApiOperation({
    summary:
      "Envoyer un message à un producteur (sms | whatsapp | ussd | voice)",
    description:
      "ussd et voice répondent 422 channel_unavailable tant qu'aucun opérateur n'est branché.",
  })
  create(
    @Client() client: PublicClient,
    @Body() dto: CreateNotificationDto,
    @RequestId() rid: string,
  ) {
    return this.notifications.create(client, dto, rid);
  }

  @Get()
  @Scopes("notifications:write")
  list(@Client() client: PublicClient, @Query() query: ListQueryDto) {
    return this.notifications.list(client, query);
  }

  @Get(":id")
  @Scopes("notifications:write")
  retrieve(@Client() client: PublicClient, @Param("id") id: string) {
    return this.notifications.retrieve(client, id);
  }
}

@ApiTags("Webhooks & événements")
@Controller("v1")
@PublicApiController()
export class WebhookEndpointsController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post("webhook_endpoints")
  @Scopes("webhooks:write")
  @ApiOperation({
    summary: "Créer un endpoint de webhook",
    description:
      "Le secret whsec_… n'est renvoyé qu'ici. Chaque envoi porte Petalia-Signature: t=…,v1=HMAC-SHA256(secret, \"t.payload\").",
  })
  create(
    @Client() client: PublicClient,
    @Body() dto: CreateWebhookEndpointDto,
    @Req() req: Request,
  ) {
    return this.webhooks.create(client, dto, req.publicApi!.version);
  }

  @Get("webhook_endpoints")
  @Scopes("webhooks:write")
  list(@Client() client: PublicClient, @Query() query: ListQueryDto) {
    return this.webhooks.list(client, query);
  }

  @Get("webhook_endpoints/:id")
  @Scopes("webhooks:write")
  retrieve(@Client() client: PublicClient, @Param("id") id: string) {
    return this.webhooks.retrieve(client, id);
  }

  @Patch("webhook_endpoints/:id")
  @Scopes("webhooks:write")
  update(
    @Client() client: PublicClient,
    @Param("id") id: string,
    @Body() dto: UpdateWebhookEndpointDto,
  ) {
    return this.webhooks.update(client, id, dto);
  }

  @Delete("webhook_endpoints/:id")
  @Scopes("webhooks:write")
  remove(@Client() client: PublicClient, @Param("id") id: string) {
    return this.webhooks.remove(client, id);
  }

  @Get("events")
  @Scopes("events:read")
  @ApiOperation({
    summary:
      "Journal des événements (30 jours de rattrapage si un webhook a échoué)",
  })
  events(@Client() client: PublicClient, @Query() query: ListEventsQueryDto) {
    return this.webhooks.listEvents(client, query);
  }

  @Get("events/:id")
  @Scopes("events:read")
  event(@Client() client: PublicClient, @Param("id") id: string) {
    return this.webhooks.retrieveEvent(client, id);
  }
}

@ApiTags("Plateforme")
@Controller("v1")
@PublicApiController()
export class PlatformController {
  constructor(
    private readonly jobs: JobsService,
    private readonly sync: SyncService,
    private readonly sandbox: SandboxService,
    private readonly meteo: MeteoService,
    @InjectRepository(Organisation)
    private readonly organisations: Repository<Organisation>,
  ) {}

  @Get("organization")
  @ApiOperation({ summary: "Organisation propriétaire de la clé" })
  async organization(@Client() client: PublicClient) {
    const org = await this.organisations.findOne({
      where: { id: client.accountOrganizationId },
    });
    if (!org) {
      throw new ProblemException("resource_missing", {
        params: { id: encodeId("organization", client.accountOrganizationId) },
      });
    }
    return {
      ...presentOrganization(org),
      livemode: client.livemode,
      api_key: {
        id: encodeId("api_key", client.apiKeyId),
        scopes: client.scopes,
        kind: client.kind,
        authenticated_via: client.via,
      },
    };
  }

  @Get("jobs/:id")
  @ApiOperation({
    summary: "Suivre un traitement asynchrone (NDVI, rapports…)",
  })
  job(@Client() client: PublicClient, @Param("id") id: string) {
    return this.jobs.retrieve(client, id);
  }

  @Get("sync")
  @Scopes("farmers:read", "parcels:read")
  @ApiOperation({
    summary: "Synchronisation hors-ligne incrémentale",
    description:
      "Rappeler avec next_cursor jusqu'à has_more = false, puis le conserver pour la prochaine session. Les suppressions arrivent en tombstones (deleted: true).",
  })
  changes(@Client() client: PublicClient, @Query() query: SyncQueryDto) {
    return this.sync.changes(client, query);
  }

  @Get("weather/current")
  @AllowPublishableKey()
  @ApiOperation({
    summary: "Météo actuelle en un point (données ouvertes, clé pk_ acceptée)",
  })
  async weather(@Query() query: WeatherQueryDto) {
    const { data, cached } = (await this.meteo.getByCoordinates(
      query.lat,
      query.lng,
    )) as {
      data: {
        temperature: number;
        humidite: number;
        vent: number;
        precipitation: number;
        description: string;
        ville: string;
      };
      cached: boolean;
    };
    return {
      object: "weather_observation",
      location: { type: "Point", coordinates: [query.lng, query.lat] },
      place: data.ville,
      air_temperature: { value: data.temperature, unit: "°C" },
      relative_humidity: { value: data.humidite, unit: "%" },
      wind_speed: { value: data.vent, unit: "km/h" },
      rainfall_last_hour: { value: data.precipitation, unit: "mm" },
      description: data.description,
      source: "openweathermap",
      cached,
    };
  }

  @Post("test_helpers/sandbox")
  @TestModeOnly()
  @Scopes(
    "farmers:write",
    "parcels:write",
    "devices:write",
    "observations:write",
  )
  @ApiOperation({
    summary: "Peupler la sandbox (Niayes, Bassin arachidier, Vallée du fleuve)",
    description:
      "Clés sk_test_ uniquement. Producteurs, parcelles, cycles, capteurs et 7 jours de mesures simulées.",
  })
  seed(@Client() client: PublicClient) {
    return this.sandbox.seed(client);
  }
}

/** OAuth2 token endpoint: authenticated by its own body, not by a bearer. */
@ApiTags("Authentification")
@Controller("v1/oauth")
@SkipTenantScope()
export class OAuthController {
  constructor(private readonly oauth: OAuthService) {}

  @Post("token")
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { limit: 30, ttl: 60_000 } })
  @ApiConsumes("application/x-www-form-urlencoded", "application/json")
  @ApiOperation({
    summary: "Obtenir un jeton d'accès (client_credentials)",
    description:
      "client_id = key_…, client_secret = sk_…, en corps ou en HTTP Basic. Jeton valable 1 h.",
  })
  token(
    @Body() dto: OAuthTokenDto,
    @Headers("authorization") authorization?: string,
  ) {
    if (dto.grant_type !== "client_credentials") {
      throw new ProblemException("unsupported_grant_type", {
        extensions: { error: "unsupported_grant_type" },
      });
    }
    let { client_id: clientId, client_secret: clientSecret } = dto;
    const basic = /^Basic\s+(\S+)$/i.exec(authorization ?? "");
    if (basic) {
      const [id, secret] = Buffer.from(basic[1], "base64")
        .toString("utf8")
        .split(":", 2);
      clientId ??= decodeURIComponent(id ?? "");
      clientSecret ??= decodeURIComponent(secret ?? "");
    }
    return this.oauth.clientCredentials({
      clientId,
      clientSecret,
      scope: dto.scope,
    });
  }
}
