import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ApiKeyController } from "./api-key.controller";
import { ApiKeyService } from "./api-key.service";
import { PartnerController } from "./partner.controller";
import { PartnerService } from "./partner.service";
import { ApiKeyGuard } from "./guards/api-key.guard";
import { QuotaGuard } from "./guards/quota.guard";
import { ApiKey } from "./entities/api-key.entity";
import { Parcelle } from "../parcelles/entities/parcelle.entity";
import { NdviData } from "../ndvi/entities/ndvi-data.entity";
import { MarketPrice } from "../market/entities/market-price.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey, Parcelle, NdviData, MarketPrice]),
  ],
  controllers: [ApiKeyController, PartnerController],
  providers: [ApiKeyService, PartnerService, ApiKeyGuard, QuotaGuard],
  exports: [ApiKeyService],
})
export class PartnerModule {}
