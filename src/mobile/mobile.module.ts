import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MobileController } from "./mobile.controller";
import { MobileService } from "./mobile.service";
import { Parcelle } from "../parcelles/entities/parcelle.entity";
import { Tache } from "../taches/entities/tache.entity";
import { Notification } from "../notifications/entities/notification.entity";
import { MeteoModule } from "../meteo/meteo.module";
import { SyncModule } from "../sync/sync.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Parcelle, Tache, Notification]),
    MeteoModule,
    SyncModule,
  ],
  controllers: [MobileController],
  providers: [MobileService],
})
export class MobileModule {}
