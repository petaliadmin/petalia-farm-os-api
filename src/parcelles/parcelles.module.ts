import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ParcellesController } from "./parcelles.controller";
import { ParcellesService } from "./parcelles.service";
import { Parcelle } from "./entities/parcelle.entity";
import { FieldPoi } from "./entities/field-poi.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Parcelle, FieldPoi])],
  controllers: [ParcellesController],
  providers: [ParcellesService],
  exports: [ParcellesService],
})
export class ParcellesModule {}
