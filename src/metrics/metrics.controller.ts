import { Controller, Get, Header, UseGuards } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { MetricsService } from "./metrics.service";
import { MetricsAuthGuard } from "./metrics-auth.guard";

@ApiExcludeController()
@Controller("metrics")
@SkipThrottle()
@UseGuards(MetricsAuthGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  async scrape(): Promise<string> {
    return this.metrics.render();
  }
}
