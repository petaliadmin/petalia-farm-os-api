import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RecoltesController } from "./recoltes.controller";
import { RecoltesService } from "./recoltes.service";
import { Recolte } from "./entities/recolte.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Recolte])],
  controllers: [RecoltesController],
  providers: [RecoltesService],
  exports: [RecoltesService],
})
export class RecoltesModule {}
