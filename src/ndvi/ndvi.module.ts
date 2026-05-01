import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bull";
import { NdviController } from "./ndvi.controller";
import { NdviService } from "./ndvi.service";
import { NdviData } from "./entities/ndvi-data.entity";
import { Parcelle } from "../parcelles/entities/parcelle.entity";
import { SentinelHubClient } from "./sentinel-hub.client";
import { NdviProcessor } from "./ndvi.processor";
import { QUEUE_NAMES } from "../common/queues";

@Module({
  imports: [
    TypeOrmModule.forFeature([NdviData, Parcelle]),
    BullModule.registerQueue({ name: QUEUE_NAMES.NDVI }),
  ],
  controllers: [NdviController],
  providers: [NdviService, SentinelHubClient, NdviProcessor],
  exports: [NdviService],
})
export class NdviModule {}
