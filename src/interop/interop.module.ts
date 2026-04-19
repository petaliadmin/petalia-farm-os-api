import { Module } from "@nestjs/common";
import { InteropController } from "./interop.controller";
import { InteropService } from "./interop.service";

@Module({
  controllers: [InteropController],
  providers: [InteropService],
  exports: [InteropService],
})
export class InteropModule {}
