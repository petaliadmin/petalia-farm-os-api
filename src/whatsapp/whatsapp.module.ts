import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bull";
import { WhatsAppController } from "./whatsapp.controller";
import { WhatsAppService } from "./whatsapp.service";
import { WhatsAppCloudClient } from "./whatsapp-cloud.client";
import { WhatsAppProcessor } from "./whatsapp.processor";
import { WhatsAppMessage } from "./entities/whatsapp-message.entity";
import { WhatsAppOptin } from "./entities/whatsapp-optin.entity";
import { User } from "../users/entities/user.entity";
import { QUEUE_NAMES } from "../common/queues";

@Module({
  imports: [
    TypeOrmModule.forFeature([WhatsAppMessage, WhatsAppOptin, User]),
    BullModule.registerQueue({ name: QUEUE_NAMES.WHATSAPP }),
  ],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, WhatsAppCloudClient, WhatsAppProcessor],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
