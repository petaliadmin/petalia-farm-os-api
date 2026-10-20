import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiProduces } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { Request } from "express";
import { SkipTenantScope } from "../../common/decorators/skip-tenant-scope.decorator";
import { QuotaGuard } from "../../partner/guards/quota.guard";
import { PublicScope } from "../public-api.constants";
import { PublicClient } from "../common/context";
import { IdempotencyInterceptor } from "../idempotency/idempotency.interceptor";
import { PublicAuthGuard } from "./public-auth.guard";

export const PUBLIC_SCOPES_KEY = "publicApiScopes";
export const ALLOW_PUBLISHABLE_KEY = "publicApiAllowPublishable";
export const TEST_MODE_ONLY_KEY = "publicApiTestModeOnly";

/** Every listed scope is required. */
export const Scopes = (...scopes: PublicScope[]) =>
  SetMetadata(PUBLIC_SCOPES_KEY, scopes);

/** Open data reachable with a publishable pk_ key. */
export const AllowPublishableKey = () =>
  SetMetadata(ALLOW_PUBLISHABLE_KEY, true);

export const TestModeOnly = () => SetMetadata(TEST_MODE_ONLY_KEY, true);

/**
 * Class decorator shared by every public controller: key/OAuth auth,
 * per-key quotas (instead of the per-IP throttler), Idempotency-Key replay,
 * and the documented contract headers.
 */
export const PublicApiController = () =>
  applyDecorators(
    UseGuards(PublicAuthGuard, QuotaGuard),
    UseInterceptors(IdempotencyInterceptor),
    SkipTenantScope(),
    SkipThrottle(),
    ApiBearerAuth(),
    ApiProduces("application/json", "application/problem+json"),
    ApiHeader({
      name: "Petalia-Version",
      required: false,
      description:
        "Version datée du contrat (ex. 2026-10-01). Défaut : la plus récente.",
    }),
    ApiHeader({
      name: "Accept-Language",
      required: false,
      description: "fr (défaut), en ou wo — langue des messages d'erreur.",
    }),
  );

export const Client = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): PublicClient => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.publicApi!.client!;
  },
);

export const RequestId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string =>
    ctx.switchToHttp().getRequest<Request>().publicApi?.requestId ?? "",
);
