import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { InteropController } from "./interop.controller";
import { InteropService } from "./interop.service";

@Module({
  imports: [ConfigModule],
  controllers: [InteropController],
  providers: [InteropService],
  exports: [InteropService],
})
export class InteropModule {}
