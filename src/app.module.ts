import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ScheduleModule } from "@nestjs/schedule";

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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.production", ".env.development", ".env"],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri:
          configService.get("MONGODB_URI") ||
          "mongodb://localhost:27017/petalia",
      }),
      inject: [ConfigService],
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
