import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, FindOptionsWhere } from "typeorm";
import { AuditLog, AuditSeverity } from "./entities/audit-log.entity";

export interface AuditEvent {
  userId?: string | null;
  organisationId?: string | null;
  action: string;
  resource?: string | null;
  resourceId?: string | null;
  severity?: AuditSeverity;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  ip?: string | null;
  userAgent?: string | null;
  changes?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  errorMessage?: string | null;
}

export interface AuditQuery {
  userId?: string;
  organisationId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  severity?: AuditSeverity;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

const REDACT_KEYS = new Set([
  "password",
  "passwordhash",
  "currentpassword",
  "newpassword",
  "token",
  "refreshtoken",
  "accesstoken",
  "secret",
  "apikey",
  "authorization",
  "cookie",
  "otp",
  "code",
]);

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  /**
   * Record an audit event. Fails open: if persistence breaks, we log and move on
   * rather than block the request. Banking compliance requires durable storage,
   * so the audit log table itself MUST be backed up daily (covered by Sprint 5).
   */
  async record(event: AuditEvent): Promise<void> {
    try {
      const entity = this.repo.create({
        userId: event.userId ?? null,
        organisationId: event.organisationId ?? null,
        action: event.action,
        resource: event.resource ?? null,
        resourceId: event.resourceId ?? null,
        severity: event.severity ?? "info",
        method: event.method ?? null,
        path: event.path ?? null,
        statusCode: event.statusCode ?? null,
        ip: event.ip ?? null,
        userAgent: event.userAgent ?? null,
        changes: this.redact(event.changes),
        metadata: this.redact(event.metadata),
        errorMessage: event.errorMessage ?? null,
      });
      await this.repo.save(entity);
    } catch (err) {
      this.logger.error(
        `Audit persistence failed for action=${event.action}: ${(err as Error).message}`,
      );
    }
  }

  async query(q: AuditQuery): Promise<{ data: AuditLog[]; total: number }> {
    const where: FindOptionsWhere<AuditLog> = {};
    if (q.userId) where.userId = q.userId;
    if (q.organisationId) where.organisationId = q.organisationId;
    if (q.action) where.action = q.action;
    if (q.resource) where.resource = q.resource;
    if (q.resourceId) where.resourceId = q.resourceId;
    if (q.severity) where.severity = q.severity;
    if (q.from && q.to) where.createdAt = Between(q.from, q.to);

    const limit = Math.min(q.limit ?? 50, 200);
    const page = Math.max(q.page ?? 1, 1);

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: "DESC" },
      take: limit,
      skip: (page - 1) * limit,
    });

    return { data, total };
  }

  private redact<T extends Record<string, unknown> | null | undefined>(
    obj: T,
  ): T {
    if (!obj || typeof obj !== "object") return obj;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (REDACT_KEYS.has(k.toLowerCase())) {
        out[k] = "[REDACTED]";
      } else if (v && typeof v === "object" && !Array.isArray(v)) {
        out[k] = this.redact(v as Record<string, unknown>);
      } else {
        out[k] = v;
      }
    }
    return out as T;
  }
}
