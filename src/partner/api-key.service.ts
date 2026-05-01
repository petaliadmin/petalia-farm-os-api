import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { ApiKey, ApiKeyScope, ALL_SCOPES } from "./entities/api-key.entity";

const KEY_PREFIX = "pk_";
const PREFIX_LEN = 11; // "pk_" + 8 chars

export interface CreateApiKeyInput {
  organisationId: string;
  partenaireNom: string;
  scopes?: ApiKeyScope[];
  quotaPerHour?: number;
  quotaPerMonth?: number;
  expiresAt?: Date | string;
}

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(@InjectRepository(ApiKey) private repo: Repository<ApiKey>) {}

  async create(
    input: CreateApiKeyInput,
  ): Promise<{ apiKey: ApiKey; rawKey: string }> {
    const scopes = input.scopes?.length ? input.scopes : ALL_SCOPES.slice(0);
    for (const s of scopes) {
      if (!ALL_SCOPES.includes(s)) {
        throw new BadRequestException(`Scope inconnu: ${s}`);
      }
    }

    const rawKey = this.generateRawKey();
    const prefix = rawKey.slice(0, PREFIX_LEN);
    const keyHash = await bcrypt.hash(rawKey, 10);

    const expiresAt = input.expiresAt
      ? new Date(input.expiresAt)
      : (null as unknown as Date);

    const saved = await this.repo.save(
      this.repo.create({
        organisationId: input.organisationId,
        partenaireNom: input.partenaireNom,
        prefix,
        keyHash,
        scopes,
        quotaPerHour: input.quotaPerHour ?? 1000,
        quotaPerMonth: input.quotaPerMonth ?? 50_000,
        active: true,
        expiresAt,
      }),
    );
    return { apiKey: saved, rawKey };
  }

  async listForOrg(organisationId: string): Promise<ApiKey[]> {
    return this.repo.find({
      where: { organisationId },
      order: { createdAt: "DESC" },
    });
  }

  async revoke(id: string, organisationId: string): Promise<void> {
    const key = await this.repo.findOne({ where: { id, organisationId } });
    if (!key) throw new NotFoundException("API key introuvable");
    await this.repo.update(id, {
      active: false,
      revokedAt: new Date(),
    });
  }

  /**
   * Verify a raw key from header. Indexed prefix lookup → bcrypt compare
   * across (typically 1) candidate. Touches lastUsedAt asynchronously.
   */
  async verify(
    rawKey: string,
  ): Promise<{ apiKey: ApiKey; scopes: ApiKeyScope[] }> {
    if (!rawKey || !rawKey.startsWith(KEY_PREFIX)) {
      throw new UnauthorizedException("API key absente ou format invalide");
    }
    const prefix = rawKey.slice(0, PREFIX_LEN);
    const candidates = await this.repo
      .createQueryBuilder("k")
      .addSelect("k.keyHash")
      .where("k.prefix = :p AND k.active = true", { p: prefix })
      .andWhere("(k.expiresAt IS NULL OR k.expiresAt > NOW())")
      .getMany();

    for (const c of candidates) {
      const ok = await bcrypt.compare(rawKey, c.keyHash);
      if (ok) {
        // fire-and-forget update
        void this.repo
          .update(c.id, { lastUsedAt: new Date() })
          .catch(() => undefined);
        return { apiKey: c, scopes: c.scopes ?? [] };
      }
    }
    throw new UnauthorizedException("API key invalide");
  }

  /** Soft-delete dangling keys after expiry — useful for cron later. */
  countExpired(): Promise<number> {
    return this.repo
      .createQueryBuilder()
      .where("expiresAt IS NOT NULL AND expiresAt < NOW() AND active = true")
      .getCount();
  }

  private generateRawKey(): string {
    // 32 bytes of entropy → 43 chars base64url. Total length ≈ 47 incl prefix.
    const buf = crypto.randomBytes(32);
    return `${KEY_PREFIX}${this.base64url(buf)}`;
  }

  private base64url(buf: Buffer): string {
    return buf
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
}
