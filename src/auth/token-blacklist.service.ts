import { Inject, Injectable } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";

/**
 * Redis-backed JWT revocation list. Logout writes a per-user invalidation
 * timestamp; the JWT strategy rejects any token issued before that timestamp.
 *
 * Why per-user (not per-token):
 *   - JWTs don't carry a server-side identity until issued — tracking each
 *     individual jti would require a write on every login (4× cost).
 *   - Logout-everywhere is the intent 95% of the time anyway.
 *   - For per-device revocation, switch to jti-based when needed.
 *
 * TTL is 30 days — matches REFRESH_TOKEN_EXPIRES_IN. Older entries can't
 * affect any still-valid token.
 */
@Injectable()
export class TokenBlacklistService {
  private static readonly TTL_MS = 30 * 24 * 3600 * 1000;

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  /**
   * Revoke every access token issued for `userId` before now.
   * Call from logout, password change, or admin-triggered force-logout.
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.cache.set(
      this.key(userId),
      Date.now(),
      TokenBlacklistService.TTL_MS,
    );
  }

  /**
   * Returns true when the token (issued at `iatSec` epoch seconds) was
   * revoked after issue. Used by JwtStrategy.validate().
   */
  async isRevoked(
    userId: string,
    iatSec: number | undefined,
  ): Promise<boolean> {
    if (!iatSec) return false;
    const revokedAtMs = await this.cache.get<number>(this.key(userId));
    if (!revokedAtMs) return false;
    return iatSec * 1000 < revokedAtMs;
  }

  private key(userId: string): string {
    return `jwt:revoked:${userId}`;
  }
}
