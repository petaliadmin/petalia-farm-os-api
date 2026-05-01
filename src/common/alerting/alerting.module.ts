import { Global, Module } from "@nestjs/common";
import { SlackAlerterService } from "./slack-alerter.service";

@Global()
@Module({
  providers: [SlackAlerterService],
  exports: [SlackAlerterService],
})
export class AlertingModule {}
