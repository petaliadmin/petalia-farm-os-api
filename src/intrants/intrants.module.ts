import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { IntrantsController } from "./intrants.controller";
import { IntrantsService } from "./intrants.service";
import { Intrant, IntrantSchema } from "./schemas/intrant.schema";
import { Mouvement, MouvementSchema } from "./schemas/mouvement.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Intrant.name, schema: IntrantSchema },
      { name: Mouvement.name, schema: MouvementSchema },
    ]),
  ],
  controllers: [IntrantsController],
  providers: [IntrantsService],
  exports: [IntrantsService],
})
export class IntrantsModule {}
