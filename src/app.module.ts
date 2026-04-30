import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { redisStore } from 'cache-manager-redis-yet';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ParcellesModule } from './parcelles/parcelles.module';
import { VisitesModule } from './visites/visites.module';
import { TachesModule } from './taches/taches.module';
import { IntrantsModule } from './intrants/intrants.module';
import { RecoltesModule } from './recoltes/recoltes.module';
import { CampagnesModule } from './campagnes/campagnes.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RapportsModule } from './rapports/rapports.module';
import { NdviModule } from './ndvi/ndvi.module';
import { MeteoModule } from './meteo/meteo.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { SyncModule } from './sync/sync.module';
import { InteropModule } from './interop/interop.module';
import { EquipesModule } from './equipes/equipes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.production', '.env.development', '.env'],
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USER', 'petalia'),
        password: config.get('DB_PASSWORD', 'secret'),
        database: config.get('DB_NAME', 'petalia'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: config.get('NODE_ENV') !== 'production',
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),

    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        store: redisStore,
        socket: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
        password: config.get('REDIS_PASSWORD') || undefined,
        ttl: 5 * 60 * 1000,
      }),
    }),

    ScheduleModule.forRoot(),
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
  ],
})
export class AppModule {}
