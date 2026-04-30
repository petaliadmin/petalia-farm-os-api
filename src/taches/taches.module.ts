import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TachesController } from "./taches.controller";
import { TachesService } from "./taches.service";
import { Tache } from "./entities/tache.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Tache])],
  controllers: [TachesController],
  providers: [TachesService],
  exports: [TachesService],
})
export class TachesModule {}
