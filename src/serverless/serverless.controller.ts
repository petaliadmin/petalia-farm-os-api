import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { SkipTenantScope } from "../common/decorators/skip-tenant-scope.decorator";
import { CronRunnerService } from "./cron-runner.service";
import { CronSecretGuard } from "./cron-secret.guard";
import { QueueDrainService } from "./queue-drain.service";

/**
 * Background work entry points for Vercel Cron (GET only, as Vercel sends).
 * Registered only when running serverless.
 */
@ApiExcludeController()
@Controller("internal")
@SkipThrottle()
@SkipTenantScope()
@UseGuards(CronSecretGuard)
export class ServerlessController {
  constructor(
    private readonly cron: CronRunnerService,
    private readonly drainer: QueueDrainService,
  ) {}

  /** Processes pending Bull jobs within the function's time budget. */
  @Get("queues/drain")
  async drain() {
    const budgetMs = parseInt(process.env.QUEUE_DRAIN_BUDGET_MS || "45000", 10);
    return { queues: await this.drainer.drain(budgetMs) };
  }

  @Get("cron")
  list() {
    return { jobs: this.cron.list() };
  }

  @Get("cron/:job")
  async run(@Param("job") job: string) {
    await this.cron.run(job);
    return { job, status: "done" };
  }
}
