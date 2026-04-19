import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { VisitesController } from "./visites.controller";
import { VisitesService } from "./visites.service";
import { Visite, VisiteSchema } from "./schemas/visite.schema";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Visite.name, schema: VisiteSchema }]),
  ],
  controllers: [VisitesController],
  providers: [VisitesService],
  exports: [VisitesService],
})
export class VisitesModule {}
