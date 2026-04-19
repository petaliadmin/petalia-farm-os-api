import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ParcellesController } from "./parcelles.controller";
import { ParcellesService } from "./parcelles.service";
import { Parcelle, ParcelleSchema } from "./schemas/parcelle.schema";
import { FieldPoi, FieldPoiSchema } from "./schemas/field-poi.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Parcelle.name, schema: ParcelleSchema },
      { name: FieldPoi.name, schema: FieldPoiSchema },
    ]),
  ],
  controllers: [ParcellesController],
  providers: [ParcellesService],
  exports: [ParcellesService],
})
export class ParcellesModule {}
