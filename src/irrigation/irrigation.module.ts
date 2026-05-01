import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IrrigationController } from "./irrigation.controller";
import { IrrigationService } from "./irrigation.service";
import { Parcelle } from "../parcelles/entities/parcelle.entity";
import { NdviData } from "../ndvi/entities/ndvi-data.entity";
import { MeteoModule } from "../meteo/meteo.module";

@Module({
  imports: [TypeOrmModule.forFeature([Parcelle, NdviData]), MeteoModule],
  controllers: [IrrigationController],
  providers: [IrrigationService],
  exports: [IrrigationService],
})
export class IrrigationModule {}
