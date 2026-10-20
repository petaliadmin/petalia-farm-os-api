import { Logger, Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CacheModule } from "@nestjs/cache-manager";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { BullModule } from "@nestjs/bull";
import { LoggerModule } from "nestjs-pino";
import { redisInsStore } from "cache-manager-redis-yet";
import { createClient, RedisClientType } from "redis";
import { TenantScopeGuard } from "./common/guards/tenant-scope.guard";
import { pinoConfig } from "./common/config/logger.config";
import { redisConnection } from "./common/config/redis.config";
import { isServerless } from "./common/runtime";
import { buildDataSourceOptions } from "./database/database.config";

import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { ParcellesModule } from "./parcelles/parcelles.module";
import { VisitesModule } from "./visites/visites.module";
import { TachesModule } from "./taches/taches.module";
import { IntrantsModule } from "./intrants/intrants.module";
import { RecoltesModule } from "./recoltes/recoltes.module";
import { CampagnesModule } from "./campagnes/campagnes.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { RapportsModule } from "./rapports/rapports.module";
import { NdviModule } from "./ndvi/ndvi.module";
import { MeteoModule } from "./meteo/meteo.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { SyncModule } from "./sync/sync.module";
import { InteropModule } from "./interop/interop.module";
import { EquipesModule } from "./equipes/equipes.module";
import { OrganisationsModule } from "./organisations/organisations.module";
import { HealthModule } from "./health/health.module";
import { AlertesModule } from "./alertes/alertes.module";
import { BenchmarksModule } from "./benchmarks/benchmarks.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { IrrigationModule } from "./irrigation/irrigation.module";
import { ExportsModule } from "./exports/exports.module";
import { MapModule } from "./map/map.module";
import { MobileModule } from "./mobile/mobile.module";
import { SatelliteModule } from "./satellite/satellite.module";
import { DiagnosticModule } from "./diagnostic/diagnostic.module";
import { WhatsAppModule } from "./whatsapp/whatsapp.module";
import { MarketModule } from "./market/market.module";
import { PartnerModule } from "./partner/partner.module";
import { BillingModule } from "./billing/billing.module";
import { MetricsModule } from "./metrics/metrics.module";
import { AlertingModule } from "./common/alerting/alerting.module";
import { AuditModule } from "./audit/audit.module";
import { AuditInterceptor } from "./audit/audit.interceptor";
import { SmsModule } from "./sms/sms.module";
import { PublicApiModule } from "./public-api/public-api.module";
import { ServerlessModule } from "./serverless/serverless.module";
import { WebsiteModule } from "./website/website.module";
import { DeveloperModule } from "./developer/developer.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.production", ".env.development", ".env"],
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...buildDataSourceOptions((key) => config.get<string>(key)),
        autoLoadEntities: true,
        // A serverless invocation cannot wait through 10 retries (default).
        ...(isServerless() ? { retryAttempts: 2, retryDelay: 1000 } : {}),
      }),
    }),

    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const { host, port, username, password, tls } = redisConnection((key) =>
          config.get<string>(key),
        );
        const reconnectStrategy = (retries: number) =>
          Math.min(retries * 200, 5000);
        const client = createClient({
          socket: tls
            ? { host, port, tls: true, servername: host, reconnectStrategy }
            : { host, port, reconnectStrategy },
          username,
          password,
          // Keeps managed Redis (Upstash) from dropping idle connections.
          pingInterval: 60_000,
        });
        // Without a listener node-redis turns a dropped socket into an
        // uncaught exception that kills the process; it reconnects by itself.
        client.on("error", (err: Error) =>
          new Logger("RedisCache").warn(`Redis cache: ${err.message}`),
        );
        await client.connect();
        const ttl = 5 * 60 * 1000;
        return {
          store: redisInsStore(client as RedisClientType, { ttl }),
          ttl,
        };
      },
    }),

    ThrottlerModule.forRoot([{ name: "global", ttl: 60_000, limit: 120 }]),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: redisConnection((key) => config.get<string>(key)),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: { age: 24 * 3600, count: 1000 },
          removeOnFail: { age: 7 * 24 * 3600 },
        },
      }),
    }),

    // On Vercel, @Cron jobs are triggered by Vercel Cron through
    // ServerlessModule instead of in-process timers.
    ...(isServerless() ? [ServerlessModule] : [ScheduleModule.forRoot()]),
    LoggerModule.forRootAsync(pinoConfig),

    AuthModule,
    UsersModule,
    ParcellesModule,
    VisitesModule,
    TachesModule,
    IntrantsModule,
    RecoltesModule,
    CampagnesModule,
    NotificationsModule,
    RapportsModule,
    NdviModule,
    MeteoModule,
    WebhooksModule,
    SyncModule,
    InteropModule,
    EquipesModule,
    OrganisationsModule,
    HealthModule,
    AlertesModule,
    BenchmarksModule,
    AnalyticsModule,
    IrrigationModule,
    ExportsModule,
    MapModule,
    MobileModule,
    SatelliteModule,
    DiagnosticModule,
    WhatsAppModule,
    MarketModule,
    PartnerModule,
    BillingModule,
    AlertingModule,
    MetricsModule,
    AuditModule,
    SmsModule,
    PublicApiModule,
    WebsiteModule,
    DeveloperModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: TenantScopeGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
