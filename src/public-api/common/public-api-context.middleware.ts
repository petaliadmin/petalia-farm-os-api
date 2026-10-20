import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomBytes } from "crypto";
import {
  CURRENT_API_VERSION,
  SUPPORTED_API_VERSIONS,
} from "../public-api.constants";
import { resolveLocale } from "./i18n";
import { ProblemException } from "./problem";
import { PublicApiContext } from "./context";

export function buildPublicApiContext(req: Request): PublicApiContext {
  const incoming = req.headers["x-request-id"];
  const requestId =
    typeof incoming === "string" && /^[\w.-]{8,64}$/.test(incoming)
      ? incoming
      : `req_${randomBytes(12).toString("base64url")}`;
  return {
    version: CURRENT_API_VERSION,
    locale: resolveLocale(req.headers["accept-language"]),
    requestId,
  };
}

/**
 * Runs on every public /api/v1 route, before guards:
 *   - resolves the locale from Accept-Language (fr | en | wo)
 *   - pins the contract version from the Petalia-Version header
 *   - assigns a Request-Id echoed in responses and error documents
 */
@Injectable()
export class PublicApiContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const context = buildPublicApiContext(req);
    req.publicApi = context;
    res.setHeader("Request-Id", context.requestId);
    res.setHeader("Content-Language", context.locale);
    res.setHeader("Vary", "Accept-Language, Petalia-Version");

    const requested = req.headers["petalia-version"];
    if (typeof requested === "string" && requested.trim() !== "") {
      const version = requested.trim();
      if (!SUPPORTED_API_VERSIONS.includes(version)) {
        res.setHeader("Petalia-Version", CURRENT_API_VERSION);
        throw new ProblemException("unsupported_api_version", {
          params: { version, supported: SUPPORTED_API_VERSIONS.join(", ") },
        });
      }
      context.version = version;
    }
    res.setHeader("Petalia-Version", context.version);
    next();
  }
}
