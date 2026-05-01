import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BenchmarksController } from "./benchmarks.controller";
import { BenchmarksService } from "./benchmarks.service";
import { BenchmarkRendement } from "./entities/benchmark-rendement.entity";
import { Parcelle } from "../parcelles/entities/parcelle.entity";
import { Recolte } from "../recoltes/entities/recolte.entity";

@Module({
  imports: [TypeOrmModule.forFeature([BenchmarkRendement, Parcelle, Recolte])],
  controllers: [BenchmarksController],
  providers: [BenchmarksService],
  exports: [BenchmarksService],
})
export class BenchmarksModule {}
