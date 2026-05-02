import { SetMetadata } from "@nestjs/common";
import { AuditSeverity } from "../entities/audit-log.entity";

export const AUDIT_KEY = "audit";

export interface AuditMetadata {
  action: string;
  resource?: string;
  severity?: AuditSeverity;
}

/**
 * Mark a controller route for audit logging. The interceptor reads this
 * metadata and persists an entry on success/failure.
 *
 *   @Audit({ action: "billing.subscription.create", resource: "subscription", severity: "warning" })
 *   @Post("subscribe") ...
 */
export const Audit = (meta: AuditMetadata) => SetMetadata(AUDIT_KEY, meta);
