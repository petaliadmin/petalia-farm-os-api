import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { Recolte } from "../recoltes/entities/recolte.entity";
import { Parcelle } from "../parcelles/entities/parcelle.entity";
import { Campagne } from "../campagnes/entities/campagne.entity";
import { Mouvement } from "../intrants/entities/mouvement.entity";
import { Intrant } from "../intrants/entities/intrant.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Recolte, Parcelle, Campagne, Mouvement, Intrant]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
