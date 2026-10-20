import { InjectQueue } from "@nestjs/bull";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Queue } from "bull";
import { IsNull, Repository } from "typeorm";
import { ApiEvent } from "../entities/api-event.entity";
import { WebhookEndpoint } from "../entities/webhook-endpoint.entity";
import {
  CURRENT_API_VERSION,
  EventType,
  PUBLIC_QUEUES,
} from "../public-api.constants";

export interface WebhookDeliveryJob {
  eventId: string;
  endpointId: string;
}

/** 12 attempts, exponential from 30 s: retries spread over ~1.5 days. */
const DELIVERY_ATTEMPTS = 12;
const DELIVERY_BACKOFF_MS = 30_000;

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(ApiEvent) private readonly events: Repository<ApiEvent>,
    @InjectRepository(WebhookEndpoint)
    private readonly endpoints: Repository<WebhookEndpoint>,
    @InjectQueue(PUBLIC_QUEUES.WEBHOOKS) private readonly queue: Queue,
  ) {}

  /**
   * Records an event and fans it out to the matching webhook endpoints.
   * Never throws: an event failure must not fail the API call that caused it.
   */
  async emit(
    organisationId: string | null,
    livemode: boolean,
    type: EventType,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (!organisationId) return;
    try {
      const event = await this.events.save(
        this.events.create({
          organisationId,
          livemode,
          type,
          data,
          apiVersion: CURRENT_API_VERSION,
        }),
      );
      const endpoints = await this.endpoints.find({
        where: {
          organisationId,
          livemode,
          status: "enabled",
          deletedAt: IsNull(),
        },
      });
      const targets = endpoints.filter(
        (e) => e.enabledEvents.includes("*") || e.enabledEvents.includes(type),
      );
      await Promise.all(
        targets.map((endpoint) =>
          this.queue.add(
            "deliver",
            {
              eventId: event.id,
              endpointId: endpoint.id,
            } as WebhookDeliveryJob,
            {
              jobId: `${event.id}:${endpoint.id}`,
              attempts: DELIVERY_ATTEMPTS,
              backoff: { type: "exponential", delay: DELIVERY_BACKOFF_MS },
              removeOnComplete: { age: 7 * 24 * 3600 },
              removeOnFail: { age: 30 * 24 * 3600 },
            },
          ),
        ),
      );
    } catch (err) {
      this.logger.error(`emit ${type} failed: ${(err as Error).message}`);
    }
  }

  emitMany(
    organisationId: string | null,
    livemode: boolean,
    type: EventType,
    items: Record<string, unknown>[],
  ): void {
    void (async () => {
      for (const data of items) {
        await this.emit(organisationId, livemode, type, data);
      }
    })();
  }
}
