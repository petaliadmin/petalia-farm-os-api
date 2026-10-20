import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash } from "crypto";
import { LessThan, Repository } from "typeorm";
import { IdempotencyRecord } from "../entities/idempotency-record.entity";
import { ProblemException } from "../common/problem";

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_KEY_LENGTH = 255;

export type BeginOutcome =
  | { kind: "proceed"; recordId: string }
  | { kind: "replay"; status: number; body: unknown };

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @InjectRepository(IdempotencyRecord)
    private readonly repo: Repository<IdempotencyRecord>,
  ) {}

  fingerprint(method: string, url: string, body: unknown): string {
    return createHash("sha256")
      .update(`${method} ${url.split("?")[0]}\n${JSON.stringify(body ?? {})}`)
      .digest("hex");
  }

  async begin(
    apiKeyId: string,
    key: string,
    fingerprint: string,
  ): Promise<BeginOutcome> {
    if (!key || key.length > MAX_KEY_LENGTH) {
      throw new ProblemException("validation_failed", {
        errors: [
          {
            field: "Idempotency-Key",
            code: "invalid",
            message: `1 to ${MAX_KEY_LENGTH} characters`,
          },
        ],
      });
    }

    // Two attempts: the second one runs after purging an expired record.
    for (let attempt = 0; attempt < 2; attempt++) {
      const inserted = await this.repo
        .createQueryBuilder()
        .insert()
        .into(IdempotencyRecord)
        .values({
          apiKeyId,
          key,
          fingerprint,
          status: "in_progress",
          expiresAt: new Date(Date.now() + TTL_MS),
        })
        .orIgnore()
        .returning(["id"])
        .execute();
      const id = (inserted.raw as { id: string }[])[0]?.id;
      if (id) return { kind: "proceed", recordId: id };

      const existing = await this.repo.findOne({ where: { apiKeyId, key } });
      if (!existing) continue;
      if (existing.expiresAt.getTime() < Date.now()) {
        await this.repo.delete(existing.id);
        continue;
      }
      if (existing.fingerprint !== fingerprint) {
        throw new ProblemException("idempotency_key_reused");
      }
      if (existing.status === "in_progress") {
        throw new ProblemException("idempotency_key_in_use");
      }
      return {
        kind: "replay",
        status: existing.responseStatus ?? 200,
        body: existing.responseBody,
      };
    }
    throw new ProblemException("idempotency_key_in_use");
  }

  async complete(recordId: string, status: number, body: unknown) {
    await this.repo
      .update(recordId, {
        status: "completed",
        responseStatus: status,
        responseBody: body as object,
      })
      .catch((err: Error) =>
        this.logger.warn(`idempotency complete failed: ${err.message}`),
      );
  }

  async release(recordId: string) {
    await this.repo
      .delete(recordId)
      .catch((err: Error) =>
        this.logger.warn(`idempotency release failed: ${err.message}`),
      );
  }

  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpired() {
    const { affected } = await this.repo.delete({
      expiresAt: LessThan(new Date()),
    });
    if (affected) this.logger.log(`Purged ${affected} idempotency records`);
  }
}
