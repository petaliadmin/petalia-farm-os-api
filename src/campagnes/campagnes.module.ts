import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CampagnesController } from "./campagnes.controller";
import { CampagnesService } from "./campagnes.service";
import { Campagne } from "./entities/campagne.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Campagne])],
  controllers: [CampagnesController],
  providers: [CampagnesService],
  exports: [CampagnesService],
})
export class CampagnesModule {}
