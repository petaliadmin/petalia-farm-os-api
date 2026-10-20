import { BullModule } from "@nestjs/bull";
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_FILTER } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { QUEUE_NAMES } from "../common/queues";
import { MeteoModule } from "../meteo/meteo.module";
import { NdviData } from "../ndvi/entities/ndvi-data.entity";
import { Organisation } from "../organisations/entities/organisation.entity";
import { Parcelle } from "../parcelles/entities/parcelle.entity";
import { PartnerModule } from "../partner/partner.module";
import { QuotaGuard } from "../partner/guards/quota.guard";
import { WhatsAppModule } from "../whatsapp/whatsapp.module";
import { OAuthService } from "./auth/oauth.service";
import { PublicAuthGuard } from "./auth/public-auth.guard";
import { ProblemDetailsFilter } from "./common/problem-details.filter";
import { PublicApiContextMiddleware } from "./common/public-api-context.middleware";
import { AccessPolicy } from "./consents/access-policy.service";
import { ConsentsService } from "./consents/consents.service";
import {
  FarmersController,
  FarmsController,
} from "./controllers/farmers.controller";
import {
  DevicesController,
  ObservationsController,
} from "./controllers/observations.controller";
import {
  CropCyclesController,
  ParcelsController,
} from "./controllers/parcels.controller";
import {
  ConsentsController,
  NotificationsController,
  OAuthController,
  PlatformController,
  WebhookEndpointsController,
} from "./controllers/platform.controller";
import { ApiEvent } from "./entities/api-event.entity";
import { ApiJob } from "./entities/api-job.entity";
import { ChannelNotification } from "./entities/channel-notification.entity";
import { Consent } from "./entities/consent.entity";
import { CropCycle } from "./entities/crop-cycle.entity";
import { DataAccessLog } from "./entities/data-access-log.entity";
import { Device } from "./entities/device.entity";
import { Farm } from "./entities/farm.entity";
import { Farmer } from "./entities/farmer.entity";
import { IdempotencyRecord } from "./entities/idempotency-record.entity";
import { Observation } from "./entities/observation.entity";
import { WebhookEndpoint } from "./entities/webhook-endpoint.entity";
import { EventsService } from "./events/events.service";
import { WebhookDeliveryProcessor } from "./events/webhook-delivery.processor";
import { WebhooksService } from "./events/webhooks.service";
import { FarmersService } from "./farmers/farmers.service";
import { IdempotencyInterceptor } from "./idempotency/idempotency.interceptor";
import { IdempotencyService } from "./idempotency/idempotency.service";
import { JobsService } from "./jobs/jobs.service";
import { NdviJobListener } from "./jobs/ndvi-job.listener";
import {
  ChannelRegistry,
  SmsChannel,
  WhatsAppChannel,
} from "./notifications/channel-providers";
import { NotificationsService } from "./notifications/notifications.service";
import { ObservationsService } from "./observations/observations.service";
import { ParcelsService } from "./parcels/parcels.service";
import { PUBLIC_QUEUES } from "./public-api.constants";
import { SandboxService } from "./sandbox/sandbox.service";
import { SyncService } from "./sync/sync.service";

export const PUBLIC_API_CONTROLLERS = [
  OAuthController,
  PlatformController,
  FarmersController,
  FarmsController,
  ParcelsController,
  CropCyclesController,
  DevicesController,
  ObservationsController,
  ConsentsController,
  NotificationsController,
  WebhookEndpointsController,
];

/**
 * Public Petalia API (/api/v1): the integration layer for third parties —
 * cooperatives' tools, fintechs, insurers, NGOs, AI agents. Lives beside the
 * internal web/mobile API, reusing its data, without changing its routes.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Farmer,
      Farm,
      CropCycle,
      Device,
      Observation,
      Consent,
      DataAccessLog,
      ApiEvent,
      WebhookEndpoint,
      ChannelNotification,
      ApiJob,
      IdempotencyRecord,
      Parcelle,
      Organisation,
      NdviData,
    ]),
    BullModule.registerQueue(
      { name: PUBLIC_QUEUES.WEBHOOKS },
      { name: QUEUE_NAMES.NDVI },
    ),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Distinct secret recommended so internal JWTs can never pass as API tokens.
        secret:
          config.get<string>("PUBLIC_API_JWT_SECRET") ??
          config.get<string>("JWT_SECRET"),
      }),
    }),
    PartnerModule,
    MeteoModule,
    WhatsAppModule,
  ],
  controllers: PUBLIC_API_CONTROLLERS,
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    PublicAuthGuard,
    QuotaGuard,
    IdempotencyInterceptor,
    IdempotencyService,
    OAuthService,
    AccessPolicy,
    ConsentsService,
    EventsService,
    WebhooksService,
    WebhookDeliveryProcessor,
    FarmersService,
    ParcelsService,
    ObservationsService,
    NotificationsService,
    SmsChannel,
    WhatsAppChannel,
    ChannelRegistry,
    JobsService,
    NdviJobListener,
    SyncService,
    SandboxService,
  ],
})
export class PublicApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(PublicApiContextMiddleware)
      .forRoutes(...PUBLIC_API_CONTROLLERS);
  }
}
