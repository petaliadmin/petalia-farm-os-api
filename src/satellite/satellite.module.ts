import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SatelliteController } from "./satellite.controller";
import { SatelliteService } from "./satellite.service";
import { SentinelStatsClient } from "./sentinel-stats.client";
import { SatelliteIndex } from "./entities/satellite-index.entity";
import { Parcelle } from "../parcelles/entities/parcelle.entity";

@Module({
  imports: [TypeOrmModule.forFeature([SatelliteIndex, Parcelle])],
  controllers: [SatelliteController],
  providers: [SatelliteService, SentinelStatsClient],
  exports: [SatelliteService],
})
export class SatelliteModule {}
