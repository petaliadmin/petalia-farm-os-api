import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { Request, Response } from "express";

/**
 * Sliding-window-ish quota using two fixed Redis counters: one rolling per
 * hour bucket, one per UTC month bucket. Both counted via INCR + EXPIRE on
 * first hit. Compatible with cache-manager wrapping (only `get` / `set`).
 */
@Injectable()
export class QuotaGuard implements CanActivate {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const partner = req.partner;
    if (!partner) return true; // ApiKeyGuard hasn't run; let it bubble

    const now = new Date();
    const hourBucket = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}H${String(now.getUTCHours()).padStart(2, "0")}`;
    const monthBucket = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const hourKey = `partner:quota:h:${partner.apiKey.id}:${hourBucket}`;
    const monthKey = `partner:quota:m:${partner.apiKey.id}:${monthBucket}`;

    const [hourCount, monthCount] = await Promise.all([
      this.bumpAndRead(hourKey, 60 * 60 * 1000),
      this.bumpAndRead(monthKey, 32 * 24 * 60 * 60 * 1000),
    ]);

    res.setHeader(
      "X-RateLimit-Limit-Hour",
      String(partner.apiKey.quotaPerHour),
    );
    res.setHeader(
      "X-RateLimit-Remaining-Hour",
      String(Math.max(0, partner.apiKey.quotaPerHour - hourCount)),
    );
    res.setHeader(
      "X-RateLimit-Limit-Month",
      String(partner.apiKey.quotaPerMonth),
    );
    res.setHeader(
      "X-RateLimit-Remaining-Month",
      String(Math.max(0, partner.apiKey.quotaPerMonth - monthCount)),
    );

    if (hourCount > partner.apiKey.quotaPerHour) {
      throw new HttpException(
        `Quota horaire dépassé (${partner.apiKey.quotaPerHour}/h)`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (monthCount > partner.apiKey.quotaPerMonth) {
      throw new HttpException(
        `Quota mensuel dépassé (${partner.apiKey.quotaPerMonth}/mois)`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private async bumpAndRead(key: string, ttlMs: number): Promise<number> {
    const current = (await this.cache.get<number>(key)) ?? 0;
    const next = current + 1;
    await this.cache.set(key, next, ttlMs);
    return next;
  }
}
