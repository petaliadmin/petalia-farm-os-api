import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MarketController } from "./market.controller";
import { MarketService } from "./market.service";
import { MarketPrice } from "./entities/market-price.entity";

@Module({
  imports: [TypeOrmModule.forFeature([MarketPrice])],
  controllers: [MarketController],
  providers: [MarketService],
  exports: [MarketService],
})
export class MarketModule {}
