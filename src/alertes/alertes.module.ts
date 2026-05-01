import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AlertesService } from "./alertes.service";
import { Parcelle } from "../parcelles/entities/parcelle.entity";
import { Tache } from "../taches/entities/tache.entity";
import { NdviData } from "../ndvi/entities/ndvi-data.entity";
import { Notification } from "../notifications/entities/notification.entity";
import { MeteoModule } from "../meteo/meteo.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Parcelle, Tache, NdviData, Notification]),
    MeteoModule,
  ],
  providers: [AlertesService],
  exports: [AlertesService],
})
export class AlertesModule {}
