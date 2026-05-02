import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable, tap, catchError, throwError } from "rxjs";
import { AuditService } from "./audit.service";
import { AUDIT_KEY, AuditMetadata } from "./decorators/audit.decorator";
import { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface";

interface RequestLike {
  method?: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  headers?: { [k: string]: string | string[] | undefined };
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  user?: AuthenticatedUser;
}

interface ResponseLike {
  statusCode?: number;
}

/**
 * Persists an audit entry for any controller route decorated with @Audit().
 * Captures success/failure outcome, request body (redacted), user, IP, and UA.
 *
 * Failure mode: if the audited operation throws, the error is rethrown — but
 * the audit row is still written with severity="critical" and the error message.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditMetadata | undefined>(
      AUDIT_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!meta) return next.handle();

    const http = ctx.switchToHttp();
    const req = http.getRequest<RequestLike>();
    const res = http.getResponse<ResponseLike>();

    const baseEvent = {
      action: meta.action,
      resource: meta.resource ?? null,
      resourceId: req.params?.id ?? null,
      severity: meta.severity ?? "info",
      method: req.method ?? null,
      path: req.originalUrl ?? req.url ?? null,
      ip: req.ip ?? null,
      userAgent: this.headerValue(req.headers?.["user-agent"]),
      userId: req.user?.sub ?? null,
      organisationId: req.user?.organisationId ?? null,
      changes: req.body ?? null,
    };

    return next.handle().pipe(
      tap(() => {
        void this.audit.record({
          ...baseEvent,
          statusCode: res.statusCode ?? null,
        });
      }),
      catchError((err: Error & { status?: number }) => {
        void this.audit.record({
          ...baseEvent,
          severity: "critical",
          statusCode: err.status ?? 500,
          errorMessage: err.message,
        });
        return throwError(() => err);
      }),
    );
  }

  private headerValue(v: string | string[] | undefined): string | null {
    if (!v) return null;
    return Array.isArray(v) ? v[0] : v;
  }
}
