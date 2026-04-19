import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CampagnesController } from "./campagnes.controller";
import { CampagnesService } from "./campagnes.service";
import { Campagne, CampagneSchema } from "./schemas/campagne.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Campagne.name, schema: CampagneSchema },
    ]),
  ],
  controllers: [CampagnesController],
  providers: [CampagnesService],
  exports: [CampagnesService],
})
export class CampagnesModule {}
