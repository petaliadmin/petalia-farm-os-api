import { Process, Processor, OnQueueFailed } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Job } from "bull";
import { QUEUE_NAMES } from "../common/queues";
import { WhatsAppMessage } from "./entities/whatsapp-message.entity";
import { WhatsAppCloudClient } from "./whatsapp-cloud.client";

export interface WhatsAppSendJob {
  messageId: string;
  toPhoneE164: string;
  mode: "template" | "text";
  templateName?: string;
  language?: string;
  bodyParameters?: string[];
  text?: string;
}

@Processor(QUEUE_NAMES.WHATSAPP)
export class WhatsAppProcessor {
  private readonly logger = new Logger(WhatsAppProcessor.name);

  constructor(
    @InjectRepository(WhatsAppMessage)
    private msgRepo: Repository<WhatsAppMessage>,
    private cloud: WhatsAppCloudClient,
  ) {}

  @Process("send")
  async send(job: Job<WhatsAppSendJob>) {
    const data = job.data;
    this.logger.log(
      `WA send job ${job.id} → ${data.toPhoneE164} mode=${data.mode}`,
    );

    try {
      const res =
        data.mode === "template"
          ? await this.cloud.sendTemplate({
              toPhoneE164: data.toPhoneE164,
              templateName: data.templateName ?? "petalia_alert",
              language: data.language ?? "fr",
              bodyParameters: data.bodyParameters ?? [],
            })
          : await this.cloud.sendText({
              toPhoneE164: data.toPhoneE164,
              text: data.text ?? "",
            });

      await this.msgRepo.update(data.messageId, {
        status: "sent",
        waMessageId: res.waMessageId,
      });
      return { messageId: data.messageId, waMessageId: res.waMessageId };
    } catch (err) {
      const e = err as Error;
      await this.msgRepo.update(data.messageId, {
        status: "failed",
        errorMessage: e.message.slice(0, 500),
      });
      throw err;
    }
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(
      `WA job ${job.id} (${job.data?.toPhoneE164}) failed: ${err.message}`,
    );
  }
}
