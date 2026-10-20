import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PublicClient } from "../common/context";
import { decodeId, decodeRef } from "../common/ids";
import { listEnvelope, ListQueryDto, paginate } from "../common/pagination";
import { normalizePhone } from "../common/phone";
import { presentNotification } from "../common/presenters";
import { ProblemException } from "../common/problem";
import { AccessPolicy } from "../consents/access-policy.service";
import { CreateNotificationDto } from "../dto/platform.dto";
import { ChannelNotification } from "../entities/channel-notification.entity";
import { Farmer } from "../entities/farmer.entity";
import { EventsService } from "../events/events.service";
import { Channel, CHANNELS } from "../public-api.constants";
import { ChannelRegistry } from "./channel-providers";

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(ChannelNotification)
    private readonly notifications: Repository<ChannelNotification>,
    private readonly channels: ChannelRegistry,
    private readonly policy: AccessPolicy,
    private readonly events: EventsService,
  ) {}

  async create(
    client: PublicClient,
    dto: CreateNotificationDto,
    requestId: string,
  ) {
    let farmer: Farmer | null = null;
    let to: string;
    if (dto.farmer) {
      const access = await this.policy.farmer(
        client,
        decodeRef("farmer", dto.farmer, "farmer"),
        "notifications:write",
        dto.farmer,
      );
      farmer = access.farmer;
      to = farmer.phone;
      this.policy.record(client, requestId, [
        {
          farmerId: farmer.id,
          resourceType: "notification",
          action: "write",
          ...access.grant,
        },
      ]);
    } else if (dto.to) {
      to = normalizePhone(dto.to, "to");
    } else {
      throw new ProblemException("validation_failed", {
        errors: [
          { field: "farmer", code: "required", message: "farmer or to" },
        ],
      });
    }

    const preferred = farmer?.preferredChannel as Channel | undefined;
    const channel: Channel =
      dto.channel ??
      (preferred && CHANNELS.includes(preferred) ? preferred : "sms");
    const provider = this.channels.get(channel);
    if (!provider) {
      throw new ProblemException("channel_unavailable", {
        params: { channel },
      });
    }

    const notification = await this.notifications.save(
      this.notifications.create({
        livemode: client.livemode,
        organisationId: client.organizationId,
        farmerId: farmer?.id ?? null,
        toPhone: to,
        channel,
        body: dto.body,
        language: dto.language ?? farmer?.preferredLanguage ?? "fr",
        status: "queued",
        metadata: dto.metadata ?? {},
      }),
    );

    // Test mode simulates delivery without contacting any operator.
    const result = client.livemode
      ? await provider.send(to, dto.body, notification.language)
      : { delivered: true, reference: "test_mode" };

    notification.status = result.delivered ? "sent" : "failed";
    notification.sentAt = result.delivered ? new Date() : null;
    notification.failureReason = result.delivered
      ? null
      : (result.error ?? "unknown").slice(0, 255);
    notification.providerReference = result.reference?.slice(0, 255) ?? null;
    const saved = await this.notifications.save(notification);
    const body = presentNotification(saved);
    void this.events.emit(
      client.organizationId,
      client.livemode,
      result.delivered ? "notification.sent" : "notification.failed",
      body,
    );
    return body;
  }

  async retrieve(client: PublicClient, id: string) {
    const n = await this.notifications.findOne({
      where: {
        id: decodeId("notification", id),
        organisationId: client.organizationId,
        livemode: client.livemode,
      },
    });
    if (!n) throw new ProblemException("resource_missing", { params: { id } });
    return presentNotification(n);
  }

  async list(client: PublicClient, query: ListQueryDto) {
    const qb = this.notifications
      .createQueryBuilder("n")
      .where('"n"."organisationId" = :org AND n.livemode = :lm', {
        org: client.organizationId,
        lm: client.livemode,
      });
    const page = await paginate(qb, query);
    return listEnvelope(
      "/v1/notifications",
      page.rows.map(presentNotification),
      page,
    );
  }
}
