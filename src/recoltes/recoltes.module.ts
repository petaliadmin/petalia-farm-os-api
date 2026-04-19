import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { RecoltesController } from "./recoltes.controller";
import { RecoltesService } from "./recoltes.service";
import { Recolte, RecolteSchema } from "./schemas/recolte.schema";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Recolte.name, schema: RecolteSchema }]),
  ],
  controllers: [RecoltesController],
  providers: [RecoltesService],
  exports: [RecoltesService],
})
export class RecoltesModule {}
