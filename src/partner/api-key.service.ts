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
import {
  ApiKey,
  ApiKeyKind,
  ApiKeyMode,
  ApiKeyScope,
  ALL_SCOPES,
} from "./entities/api-key.entity";

/** "sk_live_" / "sk_test_" / "pk_live_" / "pk_test_" + 8 chars. */
const TYPED_KEY_RE = /^(sk|pk)_(live|test)_[A-Za-z0-9_-]{8,}$/;
const TYPED_PREFIX_LEN = 16;
/** Keys issued before the public API: "pk_" + 8 chars, used as secrets. */
const LEGACY_KEY_RE = /^pk_[A-Za-z0-9_-]{8,}$/;
const LEGACY_PREFIX_LEN = 11;

export interface CreateApiKeyInput {
  organisationId: string;
  partenaireNom: string;
  scopes?: ApiKeyScope[];
  quotaPerHour?: number;
  quotaPerMonth?: number;
  expiresAt?: Date | string;
  mode?: ApiKeyMode;
  kind?: ApiKeyKind;
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

    const mode = input.mode ?? "live";
    const kind = input.kind ?? "secret";
    const rawKey = this.generateRawKey(mode, kind);
    const prefix = rawKey.slice(0, TYPED_PREFIX_LEN);
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
        mode,
        kind,
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
    const prefixLen = TYPED_KEY_RE.test(rawKey ?? "")
      ? TYPED_PREFIX_LEN
      : LEGACY_KEY_RE.test(rawKey ?? "")
        ? LEGACY_PREFIX_LEN
        : 0;
    if (!prefixLen) {
      throw new UnauthorizedException("API key absente ou format invalide");
    }
    const prefix = rawKey.slice(0, prefixLen);
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

  /** Active, non-expired key by id — used to validate OAuth access tokens. */
  async findActive(id: string): Promise<ApiKey | null> {
    return this.repo
      .createQueryBuilder("k")
      .where("k.id = :id AND k.active = true", { id })
      .andWhere("(k.expiresAt IS NULL OR k.expiresAt > NOW())")
      .getOne();
  }

  /** Soft-delete dangling keys after expiry — useful for cron later. */
  countExpired(): Promise<number> {
    return this.repo
      .createQueryBuilder()
      .where("expiresAt IS NOT NULL AND expiresAt < NOW() AND active = true")
      .getCount();
  }

  private generateRawKey(mode: ApiKeyMode, kind: ApiKeyKind): string {
    // 32 bytes of entropy → 43 chars base64url. Total length ≈ 51 incl prefix.
    const buf = crypto.randomBytes(32);
    const type = kind === "publishable" ? "pk" : "sk";
    return `${type}_${mode}_${this.base64url(buf)}`;
  }

  private base64url(buf: Buffer): string {
    return buf
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
}
