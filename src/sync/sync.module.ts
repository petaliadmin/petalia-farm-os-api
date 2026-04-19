import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { SyncController } from "./sync.controller";
import { SyncService } from "./sync.service";
import { AgroRule, AgroRuleSchema } from "./schemas/agro-rule.schema";
import {
  ExpertRequest,
  ExpertRequestSchema,
} from "./schemas/expert-request.schema";
import { Parcelle, ParcelleSchema } from "../parcelles/schemas/parcelle.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AgroRule.name, schema: AgroRuleSchema },
      { name: ExpertRequest.name, schema: ExpertRequestSchema },
      { name: Parcelle.name, schema: ParcelleSchema },
    ]),
  ],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
