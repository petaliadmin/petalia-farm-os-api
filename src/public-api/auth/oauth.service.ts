import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ApiKeyService } from "../../partner/api-key.service";
import { encodeId, tryDecodeId } from "../common/ids";
import { ProblemException } from "../common/problem";

export const ACCESS_TOKEN_AUDIENCE = "petalia-public-api";
export const ACCESS_TOKEN_TTL_SECONDS = 3600;

export interface AccessTokenClaims {
  /** Public API key id (key_…). */
  sub: string;
  org: string;
  scope: string;
  livemode: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
}

/**
 * OAuth2 client_credentials for B2B integrations: client_id is the public
 * key id (key_…), client_secret the secret key (sk_…). Tokens are short-lived
 * and can be narrowed to a subset of the key's scopes.
 *
 * authorization_code + PKCE (apps acting for a farmer) is the next step; until
 * then farmer-level access goes through POST /v1/consents (SMS confirmation).
 */
@Injectable()
export class OAuthService {
  constructor(
    private readonly apiKeys: ApiKeyService,
    private readonly jwt: JwtService,
  ) {}

  async clientCredentials(input: {
    clientId?: string;
    clientSecret?: string;
    scope?: string;
  }): Promise<TokenResponse> {
    const keyId = input.clientId
      ? tryDecodeId("api_key", input.clientId)
      : null;
    if (!keyId || !input.clientSecret?.startsWith("sk_")) {
      throw new ProblemException("invalid_client", {
        extensions: { error: "invalid_client" },
      });
    }

    let verified: Awaited<ReturnType<ApiKeyService["verify"]>>;
    try {
      verified = await this.apiKeys.verify(input.clientSecret);
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw new ProblemException("invalid_client", {
          extensions: { error: "invalid_client" },
        });
      }
      throw err;
    }
    if (verified.apiKey.id !== keyId) {
      throw new ProblemException("invalid_client", {
        extensions: { error: "invalid_client" },
      });
    }

    const granted = verified.scopes as string[];
    const requested = input.scope?.split(" ").filter(Boolean);
    const outOfReach = requested?.find((s) => !granted.includes(s));
    if (outOfReach) {
      throw new ProblemException("insufficient_scope", {
        params: { scope: outOfReach },
        extensions: { error: "invalid_scope" },
      });
    }
    const scope = (requested ?? granted).join(" ");

    const claims: AccessTokenClaims = {
      sub: encodeId("api_key", verified.apiKey.id),
      org: encodeId("organization", verified.apiKey.organisationId),
      scope,
      livemode: (verified.apiKey.mode ?? "live") === "live",
    };
    const accessToken = await this.jwt.signAsync(claims, {
      audience: ACCESS_TOKEN_AUDIENCE,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      scope,
    };
  }
}
