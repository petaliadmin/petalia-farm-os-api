import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { Request, Response } from "express";
import { PUBLIC_API_DOCS_BASE } from "../public-api.constants";
import { PublicApiContext } from "./context";
import { translate } from "./i18n";
import { FieldError, PROBLEMS, ProblemCode, ProblemException } from "./problem";
import { buildPublicApiContext } from "./public-api-context.middleware";

/** Routes under /api/v1 that predate the public API (Flutter sync). */
const LEGACY_V1_PATHS = [
  "/api/v1/sync/",
  "/api/v1/agro_rules",
  "/api/v1/expert_requests",
];

export function isPublicApiPath(path: string): boolean {
  if (!path.startsWith("/api/v1/") && path !== "/api/v1") return false;
  return !LEGACY_V1_PATHS.some((p) => path.startsWith(p));
}

export interface ProblemDocument {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  request_id: string;
  errors?: FieldError[];
  [extension: string]: unknown;
}

/**
 * Renders every error raised on a public route as application/problem+json
 * (RFC 9457), translated with the request locale. Other routes keep Nest's
 * default error format so existing web and mobile clients are unaffected.
 */
@Catch()
export class ProblemDetailsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger("PublicApi");

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== "http") return super.catch(exception, host);
    const req = host.switchToHttp().getRequest<Request>();
    const res = host.switchToHttp().getResponse<Response>();
    const path = (req.originalUrl ?? req.url ?? "").split("?")[0];
    if (!req.publicApi && !isPublicApiPath(path)) {
      return super.catch(exception, host);
    }

    const context = req.publicApi ?? buildPublicApiContext(req);
    const problem = toProblem(exception, context, req);
    if (problem.status >= 500) {
      this.logger.error(
        `${problem.request_id} ${req.method} ${path}: ${
          (exception as Error)?.stack ?? exception
        }`,
      );
    }
    if (res.headersSent) return;
    res.setHeader("Request-Id", context.requestId);
    res
      .status(problem.status)
      .type("application/problem+json")
      .send(JSON.stringify(problem));
  }
}

export function toProblem(
  exception: unknown,
  context: PublicApiContext,
  req: Pick<Request, "method" | "originalUrl" | "url">,
): ProblemDocument {
  const instance = (req.originalUrl ?? req.url ?? "").split("?")[0];
  const build = (
    code: ProblemCode,
    params?: Record<string, unknown>,
    errors?: FieldError[],
    extensions?: Record<string, unknown>,
  ): ProblemDocument => {
    const def = PROBLEMS[code];
    return {
      type: `${PUBLIC_API_DOCS_BASE}/errors/${code}`,
      title: translate(def.title, context.locale, params),
      status: def.status,
      detail: translate(def.detail, context.locale, params),
      instance,
      code,
      request_id: context.requestId,
      ...(errors?.length ? { errors } : {}),
      ...(extensions ?? {}),
    };
  };

  if (exception instanceof ProblemException) {
    return build(
      exception.code,
      exception.problem.params,
      exception.problem.errors,
      exception.problem.extensions,
    );
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const body = exception.getResponse() as
      | string
      | { message?: string | string[] };
    const message =
      typeof body === "string"
        ? body
        : Array.isArray(body?.message)
          ? body.message.join("; ")
          : (body?.message ?? exception.message);

    if (status === HttpStatus.BAD_REQUEST && typeof body === "object") {
      const messages = Array.isArray(body?.message) ? body.message : null;
      if (messages) {
        return build(
          "validation_failed",
          undefined,
          messages.map(toFieldError),
        );
      }
    }
    if (status === HttpStatus.NOT_FOUND) {
      return message.startsWith("Cannot ")
        ? build("route_missing", { method: req.method, path: instance })
        : build("resource_missing", { id: instance.split("/").pop() });
    }
    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      return build("rate_limited", { reason: message });
    }
    if (status === HttpStatus.UNAUTHORIZED) {
      return build("authentication_required");
    }
    // Errors raised by reused internal services keep their own message.
    return {
      type: "about:blank",
      title: HttpStatus[status]?.toString().replace(/_/g, " ") ?? "Error",
      status,
      detail: message,
      instance,
      code: `http_${status}`,
      request_id: context.requestId,
    };
  }

  return build("internal_error");
}

/** "geometry.type must be a string" → { field: "geometry.type", ... } */
function toFieldError(message: string): FieldError {
  const unknown = /^property (\S+) should not exist$/.exec(message);
  if (unknown) {
    return { field: unknown[1], code: "unknown_field", message };
  }
  const field = message.split(" ")[0];
  return { field, code: "invalid", message };
}
