import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { ApiKeyService } from "../../partner/api-key.service";
import { ApiKey } from "../../partner/entities/api-key.entity";
import { PublicClient } from "../common/context";
import { tryDecodeId } from "../common/ids";
import { buildPublicApiContext } from "../common/public-api-context.middleware";
import { ProblemException } from "../common/problem";
import {
  ALLOW_PUBLISHABLE_KEY,
  PUBLIC_SCOPES_KEY,
  TEST_MODE_ONLY_KEY,
} from "./decorators";
import { ACCESS_TOKEN_AUDIENCE, AccessTokenClaims } from "./oauth.service";
import { sandboxOrganizationId } from "./sandbox";

/**
 * Authenticates a public API call with either:
 *   - a raw key: `Authorization: Bearer sk_live_…` (or X-API-Key), or
 *   - an OAuth2 access token from POST /v1/oauth/token.
 * Then enforces key kind, test/live mode and the scopes of the route.
 */
@Injectable()
export class PublicAuthGuard implements CanActivate {
  constructor(
    private readonly apiKeys: ApiKeyService,
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    req.publicApi ??= buildPublicApiContext(req);

    const credential = this.extractCredential(req);
    if (!credential) throw new ProblemException("authentication_required");

    const { apiKey, client } = /^(sk|pk)_/.test(credential)
      ? await this.fromApiKey(credential)
      : await this.fromAccessToken(credential);

    const targets = [context.getHandler(), context.getClass()];
    const allowPublishable = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PUBLISHABLE_KEY,
      targets,
    );
    if (client.kind === "publishable" && !allowPublishable) {
      throw new ProblemException("publishable_key_not_allowed");
    }

    if (
      this.reflector.getAllAndOverride<boolean>(TEST_MODE_ONLY_KEY, targets) &&
      client.livemode
    ) {
      throw new ProblemException("test_mode_only");
    }

    const required =
      this.reflector.getAllAndOverride<string[]>(PUBLIC_SCOPES_KEY, targets) ??
      [];
    const missing = required.find((s) => !client.scopes.includes(s));
    if (missing) {
      throw new ProblemException("insufficient_scope", {
        params: { scope: missing },
        extensions: { required_scopes: required },
      });
    }

    req.publicApi.client = client;
    // QuotaGuard (shared with /partner) reads quotas from req.partner.
    req.partner = {
      apiKey,
      organisationId: apiKey.organisationId,
      scopes: apiKey.scopes,
    };
    return true;
  }

  private extractCredential(req: Request): string | null {
    const header = req.headers.authorization;
    if (header) {
      const match = /^Bearer\s+(\S+)$/i.exec(header);
      return match ? match[1] : null;
    }
    const xKey = req.headers["x-api-key"];
    return typeof xKey === "string" && xKey ? xKey : null;
  }

  private async fromApiKey(
    raw: string,
  ): Promise<{ apiKey: ApiKey; client: PublicClient }> {
    try {
      const { apiKey, scopes } = await this.apiKeys.verify(raw);
      return {
        apiKey,
        client: this.toClient(apiKey, scopes, "api_key"),
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw new ProblemException("invalid_api_key");
      }
      throw err;
    }
  }

  private async fromAccessToken(
    token: string,
  ): Promise<{ apiKey: ApiKey; client: PublicClient }> {
    let claims: AccessTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessTokenClaims>(token, {
        audience: ACCESS_TOKEN_AUDIENCE,
      });
    } catch {
      throw new ProblemException("invalid_api_key");
    }
    // A revoked key invalidates every token issued from it.
    const keyId = tryDecodeId("api_key", claims.sub);
    const apiKey = keyId ? await this.apiKeys.findActive(keyId) : null;
    if (!apiKey) throw new ProblemException("invalid_api_key");
    const scopes = (claims.scope ?? "")
      .split(" ")
      .filter((s) => (apiKey.scopes as string[]).includes(s));
    return { apiKey, client: this.toClient(apiKey, scopes, "oauth") };
  }

  private toClient(
    apiKey: ApiKey,
    scopes: string[],
    via: PublicClient["via"],
  ): PublicClient {
    const livemode = (apiKey.mode ?? "live") === "live";
    return {
      organizationId: livemode
        ? apiKey.organisationId
        : sandboxOrganizationId(apiKey.organisationId),
      accountOrganizationId: apiKey.organisationId,
      apiKeyId: apiKey.id,
      scopes,
      livemode,
      kind: apiKey.kind ?? "secret",
      via,
    };
  }
}
