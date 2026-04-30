import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IntrantsController } from "./intrants.controller";
import { IntrantsService } from "./intrants.service";
import { Intrant } from "./entities/intrant.entity";
import { Mouvement } from "./entities/mouvement.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Intrant, Mouvement])],
  controllers: [IntrantsController],
  providers: [IntrantsService],
  exports: [IntrantsService],
})
export class IntrantsModule {}
