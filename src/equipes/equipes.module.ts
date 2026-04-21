import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { EquipesController } from "./equipes.controller";
import { EquipesService } from "./equipes.service";
import { Equipe, EquipeSchema } from "./schemas/equipe.schema";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Equipe.name, schema: EquipeSchema }]),
    UsersModule,
  ],
  controllers: [EquipesController],
  providers: [EquipesService],
  exports: [EquipesService],
})
export class EquipesModule {}
