import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { TachesController } from "./taches.controller";
import { TachesService } from "./taches.service";
import { Tache, TacheSchema } from "./schemas/tache.schema";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Tache.name, schema: TacheSchema }]),
  ],
  controllers: [TachesController],
  providers: [TachesService],
  exports: [TachesService],
})
export class TachesModule {}
