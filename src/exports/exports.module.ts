import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ExportsController } from "./exports.controller";
import { ExportsService } from "./exports.service";
import { Parcelle } from "../parcelles/entities/parcelle.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Parcelle])],
  controllers: [ExportsController],
  providers: [ExportsService],
  exports: [ExportsService],
})
export class ExportsModule {}
