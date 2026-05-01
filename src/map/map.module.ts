import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MapController } from "./map.controller";
import { MapService } from "./map.service";
import { Parcelle } from "../parcelles/entities/parcelle.entity";
import { NdviData } from "../ndvi/entities/ndvi-data.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Parcelle, NdviData])],
  controllers: [MapController],
  providers: [MapService],
  exports: [MapService],
})
export class MapModule {}
