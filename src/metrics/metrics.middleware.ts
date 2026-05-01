import { Injectable, NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { MetricsService } from "./metrics.service";

interface ExpressLike {
  method: string;
  path: string;
  baseUrl?: string;
  route?: { path?: string };
}

interface ResponseLike {
  statusCode: number;
  on(event: "finish", cb: () => void): void;
}

/**
 * Records HTTP request count + latency for every API call.
 * Uses the matched route template (e.g. /api/parcelles/:id) to keep
 * cardinality bounded — never the raw URL with IDs in it.
 */
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const r = req as unknown as ExpressLike;
    const s = res as unknown as ResponseLike;
    const start = process.hrtime.bigint();

    s.on("finish", () => {
      const route = this.resolveRoute(r);
      const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics.recordHttp(r.method, route, s.statusCode, durationSec);
    });

    (next as () => void)();
  }

  private resolveRoute(req: ExpressLike): string {
    const matched = req.route?.path;
    if (matched) {
      const base = (req.baseUrl || "").replace(/\/$/, "");
      return `${base}${matched}` || matched;
    }
    return (req.path || "unknown").split("?")[0];
  }
}
