import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { isIP } from "net";
import { IsNull, Repository } from "typeorm";
import { PublicClient } from "../common/context";
import { decodeId } from "../common/ids";
import { listEnvelope, ListQueryDto, paginate } from "../common/pagination";
import { presentEvent, presentWebhookEndpoint } from "../common/presenters";
import { ProblemException } from "../common/problem";
import {
  CreateWebhookEndpointDto,
  ListEventsQueryDto,
  UpdateWebhookEndpointDto,
} from "../dto/platform.dto";
import { ApiEvent } from "../entities/api-event.entity";
import { WebhookEndpoint } from "../entities/webhook-endpoint.entity";
import { generateWebhookSecret } from "./signature";

const MAX_ENDPOINTS_PER_MODE = 16;

/**
 * Rejects obviously internal targets. This is a first line only: the
 * delivery worker should also run behind an egress proxy that blocks
 * private ranges (DNS rebinding is not caught here).
 */
function assertDeliverableUrl(raw: string, livemode: boolean): void {
  const fail = (message: string) => {
    throw new ProblemException("validation_failed", {
      errors: [{ field: "url", code: "invalid_url", message }],
    });
  };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail("not a valid URL");
  }
  if (livemode && url.protocol !== "https:")
    fail("live endpoints must use https");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const privateV4 =
    /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
      host,
    );
  const privateV6 = isIP(host) === 6 && /^(::1?$|f[cd]|fe80)/.test(host);
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    privateV4 ||
    privateV6
  ) {
    fail("private or loopback hosts are not allowed");
  }
}

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(WebhookEndpoint)
    private readonly endpoints: Repository<WebhookEndpoint>,
    @InjectRepository(ApiEvent) private readonly events: Repository<ApiEvent>,
  ) {}

  async create(
    client: PublicClient,
    dto: CreateWebhookEndpointDto,
    apiVersion: string,
  ) {
    assertDeliverableUrl(dto.url, client.livemode);
    const count = await this.endpoints.count({
      where: {
        organisationId: client.organizationId,
        livemode: client.livemode,
        deletedAt: IsNull(),
      },
    });
    if (count >= MAX_ENDPOINTS_PER_MODE) {
      throw new ProblemException("validation_failed", {
        errors: [
          {
            field: "url",
            code: "limit_reached",
            message: `max ${MAX_ENDPOINTS_PER_MODE} endpoints`,
          },
        ],
      });
    }
    const secret = generateWebhookSecret();
    const endpoint = await this.endpoints.save(
      this.endpoints.create({
        livemode: client.livemode,
        organisationId: client.organizationId,
        url: dto.url,
        description: dto.description ?? null,
        enabledEvents: [...new Set(dto.enabled_events)],
        secret,
        status: "enabled",
        apiVersion,
        metadata: dto.metadata ?? {},
      }),
    );
    return presentWebhookEndpoint(endpoint, secret);
  }

  async retrieve(client: PublicClient, id: string) {
    return presentWebhookEndpoint(await this.load(client, id));
  }

  async update(
    client: PublicClient,
    id: string,
    dto: UpdateWebhookEndpointDto,
  ) {
    const endpoint = await this.load(client, id);
    if (dto.url !== undefined) {
      assertDeliverableUrl(dto.url, client.livemode);
      endpoint.url = dto.url;
    }
    if (dto.enabled_events !== undefined)
      endpoint.enabledEvents = [...new Set(dto.enabled_events)];
    if (dto.description !== undefined) endpoint.description = dto.description;
    if (dto.status !== undefined) endpoint.status = dto.status;
    return presentWebhookEndpoint(await this.endpoints.save(endpoint));
  }

  async remove(client: PublicClient, id: string) {
    const endpoint = await this.load(client, id);
    endpoint.deletedAt = new Date();
    endpoint.status = "disabled";
    await this.endpoints.save(endpoint);
    return { id, object: "webhook_endpoint" as const, deleted: true };
  }

  async list(client: PublicClient, query: ListQueryDto) {
    const qb = this.endpoints
      .createQueryBuilder("w")
      .where(
        '"w"."organisationId" = :org AND w.livemode = :lm AND "w"."deletedAt" IS NULL',
        {
          org: client.organizationId,
          lm: client.livemode,
        },
      );
    const page = await paginate(qb, query);
    return listEnvelope(
      "/v1/webhook_endpoints",
      page.rows.map((w) => presentWebhookEndpoint(w)),
      page,
    );
  }

  async listEvents(client: PublicClient, query: ListEventsQueryDto) {
    const qb = this.events
      .createQueryBuilder("e")
      .where('"e"."organisationId" = :org AND e.livemode = :lm', {
        org: client.organizationId,
        lm: client.livemode,
      });
    if (query.type) qb.andWhere("e.type = :type", { type: query.type });
    const page = await paginate(qb, query);
    return listEnvelope("/v1/events", page.rows.map(presentEvent), page);
  }

  async retrieveEvent(client: PublicClient, id: string) {
    const event = await this.events.findOne({
      where: {
        id: decodeId("event", id),
        organisationId: client.organizationId,
        livemode: client.livemode,
      },
    });
    if (!event)
      throw new ProblemException("resource_missing", { params: { id } });
    return presentEvent(event);
  }

  private async load(client: PublicClient, id: string) {
    const endpoint = await this.endpoints.findOne({
      where: {
        id: decodeId("webhook_endpoint", id),
        organisationId: client.organizationId,
        livemode: client.livemode,
        deletedAt: IsNull(),
      },
    });
    if (!endpoint)
      throw new ProblemException("resource_missing", { params: { id } });
    return endpoint;
  }
}
