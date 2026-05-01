import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}

/**
 * Restricts /api/metrics to:
 *  - Local-network scrapers (loopback, RFC1918) — for ECS/Prometheus sidecars
 *  - Or a static bearer token via METRICS_TOKEN env var
 *
 * Falls open in development only. In any other env, missing token + non-local
 * IP returns 401. Prevents leaking infra signal to the public internet.
 */
@Injectable()
export class MetricsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestLike>();

    if (process.env.NODE_ENV === "development") return true;

    const token = process.env.METRICS_TOKEN;
    if (token) {
      const raw = req.headers?.authorization;
      const header = Array.isArray(raw) ? raw[0] : raw || "";
      const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (provided && provided === token) return true;
    }

    if (this.isPrivateIp(req.ip)) return true;

    throw new UnauthorizedException("Metrics endpoint requires authentication");
  }

  private isPrivateIp(ip?: string): boolean {
    if (!ip) return false;
    const stripped = ip.replace(/^::ffff:/, "");
    if (stripped === "127.0.0.1" || stripped === "::1") return true;
    if (/^10\./.test(stripped)) return true;
    if (/^192\.168\./.test(stripped)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(stripped)) return true;
    return false;
  }
}
