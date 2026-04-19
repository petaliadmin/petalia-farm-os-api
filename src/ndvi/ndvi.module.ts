import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { NdviController } from "./ndvi.controller";
import { NdviService } from "./ndvi.service";
import { NdviData, NdviDataSchema } from "./schemas/ndvi.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NdviData.name, schema: NdviDataSchema },
    ]),
  ],
  controllers: [NdviController],
  providers: [NdviService],
  exports: [NdviService],
})
export class NdviModule {}
