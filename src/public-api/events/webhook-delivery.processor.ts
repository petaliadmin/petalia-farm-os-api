import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import axios from "axios";
import { Job } from "bull";
import { Repository } from "typeorm";
import { ApiEvent } from "../entities/api-event.entity";
import { WebhookEndpoint } from "../entities/webhook-endpoint.entity";
import { presentEvent } from "../common/presenters";
import { PUBLIC_QUEUES } from "../public-api.constants";
import { WebhookDeliveryJob } from "./events.service";
import { SIGNATURE_HEADER, signPayload } from "./signature";

/** POSTs signed events to integrators; any non-2xx is retried with backoff. */
@Processor(PUBLIC_QUEUES.WEBHOOKS)
export class WebhookDeliveryProcessor {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);

  constructor(
    @InjectRepository(ApiEvent) private readonly events: Repository<ApiEvent>,
    @InjectRepository(WebhookEndpoint)
    private readonly endpoints: Repository<WebhookEndpoint>,
  ) {}

  @Process("deliver")
  async deliver(job: Job<WebhookDeliveryJob>) {
    const endpoint = await this.endpoints
      .createQueryBuilder("w")
      .addSelect("w.secret")
      .where("w.id = :id", { id: job.data.endpointId })
      .getOne();
    const event = await this.events.findOne({
      where: { id: job.data.eventId },
    });
    if (
      !endpoint ||
      !event ||
      endpoint.deletedAt ||
      endpoint.status !== "enabled"
    ) {
      return { skipped: true };
    }

    const payload = JSON.stringify(presentEvent(event));
    const response = await axios.post(endpoint.url, payload, {
      timeout: 10_000,
      maxRedirects: 0,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Petalia-Webhooks/1.0",
        "Petalia-Version": endpoint.apiVersion,
        [SIGNATURE_HEADER]: signPayload(endpoint.secret, payload),
      },
      validateStatus: (s) => s >= 200 && s < 300,
    });
    return { status: response.status };
  }

  @OnQueueFailed()
  onFailed(job: Job<WebhookDeliveryJob>, err: Error) {
    this.logger.warn(
      `webhook ${job.id} attempt ${job.attemptsMade}/${job.opts.attempts} failed: ${err.message}`,
    );
  }
}
