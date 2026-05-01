import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { QUEUE_NAMES } from "../common/queues";
import { WhatsAppMessage } from "./entities/whatsapp-message.entity";
import { WhatsAppOptin } from "./entities/whatsapp-optin.entity";
import { User } from "../users/entities/user.entity";
import { WhatsAppSendJob } from "./whatsapp.processor";
import { WhatsAppWebhookPayload } from "./whatsapp.controller";

const PHONE_E164 = /^\+[1-9]\d{6,14}$/;

export interface NotifySendInput {
  userId: string;
  templateName: string;
  bodyParameters: string[];
  topic?: string;
  language?: string;
  notificationId?: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    @InjectRepository(WhatsAppMessage)
    private msgRepo: Repository<WhatsAppMessage>,
    @InjectRepository(WhatsAppOptin)
    private optinRepo: Repository<WhatsAppOptin>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectQueue(QUEUE_NAMES.WHATSAPP)
    private whatsappQueue: Queue<WhatsAppSendJob>,
  ) {}

  async optIn(
    userId: string,
    phoneE164: string,
    topics: string[] | undefined,
    language: string | undefined,
  ): Promise<WhatsAppOptin> {
    if (!PHONE_E164.test(phoneE164)) {
      throw new BadRequestException(
        "Num�ro doit �tre au format E.164 (+221XXXXXXXXX)",
      );
    }
    const existing = await this.optinRepo.findOne({ where: { userId } });
    const payload: Partial<WhatsAppOptin> = {
      userId,
      phoneE164,
      optedIn: true,
      optedInAt: new Date(),
      optedOutAt: null as unknown as Date,
      topics: topics?.length ? topics : ["alerte", "avertissement"],
      language: language ?? "fr",
    };
    if (existing) {
      await this.optinRepo.update(existing.id, payload);
      return (await this.optinRepo.findOne({
        where: { id: existing.id },
      })) as WhatsAppOptin;
    }
    return this.optinRepo.save(this.optinRepo.create(payload));
  }

  async optOut(userId: string): Promise<void> {
    const existing = await this.optinRepo.findOne({ where: { userId } });
    if (!existing) throw new NotFoundException("Opt-in introuvable");
    await this.optinRepo.update(existing.id, {
      optedIn: false,
      optedOutAt: new Date(),
    });
  }

  async getOptin(userId: string): Promise<WhatsAppOptin | null> {
    return this.optinRepo.findOne({ where: { userId } });
  }

  /**
   * Public entry point used by AlertesService. Resolves the user's opt-in,
   * persists a queued message, and enqueues the Bull job.
   * Returns null if the user is not opted-in for the given topic � the
   * caller should not treat this as an error.
   */
  async sendNotification(
    input: NotifySendInput,
  ): Promise<WhatsAppMessage | null> {
    const optin = await this.optinRepo.findOne({
      where: { userId: input.userId, optedIn: true },
    });
    if (!optin) return null;
    if (
      input.topic &&
      optin.topics.length &&
      !optin.topics.includes(input.topic)
    ) {
      return null;
    }

    const message = await this.msgRepo.save(
      this.msgRepo.create({
        userId: input.userId,
        toPhoneE164: optin.phoneE164,
        direction: "outbound",
        status: "queued",
        templateName: input.templateName,
        language: input.language ?? optin.language,
        variables: { parameters: input.bodyParameters },
        notificationId: input.notificationId,
      }),
    );

    await this.whatsappQueue.add(
      "send",
      {
        messageId: message.id,
        toPhoneE164: optin.phoneE164,
        mode: "template",
        templateName: input.templateName,
        language: input.language ?? optin.language,
        bodyParameters: input.bodyParameters,
      },
      { jobId: `wa-${message.id}` },
    );
    return message;
  }

  /**
   * Inbound webhook payload (Meta Cloud API).
   * Persists incoming messages and updates outbound delivery statuses.
   */
  async ingestWebhook(
    payload: WhatsAppWebhookPayload,
  ): Promise<{ processed: number }> {
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    let processed = 0;

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value;
        if (!value) continue;

        for (const status of value.statuses ?? []) {
          if (!status?.id || !status?.status) continue;
          const mapped = this.mapStatus(status.status);
          if (!mapped) continue;
          await this.msgRepo.update(
            { waMessageId: status.id },
            { status: mapped },
          );
          processed++;
        }

        for (const msg of value.messages ?? []) {
          const fromPhone: string | undefined = msg?.from
            ? `+${String(msg.from).replace(/^\+/, "")}`
            : undefined;
          const text: string =
            msg?.text?.body ??
            msg?.button?.text ??
            msg?.interactive?.button_reply?.title ??
            "";
          const user = fromPhone
            ? await this.userRepo.findOne({ where: { phone: fromPhone } })
            : null;
          await this.msgRepo.save(
            this.msgRepo.create({
              userId: user?.id,
              toPhoneE164: fromPhone ?? "unknown",
              direction: "inbound",
              status: "received",
              bodyText: text,
              waMessageId: msg?.id,
            }),
          );

          if (user && /^stop$/i.test(text.trim())) {
            await this.optOut(user.id).catch(() => undefined);
            this.logger.log(`Opt-out auto via STOP de ${fromPhone}`);
          }
          processed++;
        }
      }
    }
    return { processed };
  }

  async listOutboundForUser(userId: string): Promise<WhatsAppMessage[]> {
    return this.msgRepo.find({
      where: { userId, direction: "outbound" },
      order: { createdAt: "DESC" },
      take: 50,
    });
  }

  private mapStatus(
    s: string,
  ): "sent" | "delivered" | "read" | "failed" | null {
    switch (s) {
      case "sent":
        return "sent";
      case "delivered":
        return "delivered";
      case "read":
        return "read";
      case "failed":
        return "failed";
      default:
        return null;
    }
  }
}
