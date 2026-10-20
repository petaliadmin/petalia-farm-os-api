import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { timingSafeEqual } from "crypto";

/**
 * Vercel Cron calls the endpoint with "Authorization: Bearer $CRON_SECRET"
 * (CRON_SECRET is a project environment variable). Without the secret the
 * endpoints stay closed.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const secret = process.env.CRON_SECRET;
    const req = context.switchToHttp().getRequest();
    const header: string = req.headers?.authorization || "";
    const provided = Buffer.from(
      header.startsWith("Bearer ") ? header.slice(7) : "",
    );
    const expected = Buffer.from(secret || "");

    if (
      secret &&
      provided.length === expected.length &&
      timingSafeEqual(provided, expected)
    ) {
      return true;
    }
    throw new UnauthorizedException("Invalid cron secret");
  }
}
