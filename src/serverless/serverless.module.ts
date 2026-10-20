import { Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";
import { CronRunnerService } from "./cron-runner.service";
import { QueueDrainService } from "./queue-drain.service";
import { ServerlessController } from "./serverless.controller";

/**
 * Replaces ScheduleModule and the Bull polling loops on Vercel: background
 * work runs when Vercel Cron calls /api/internal/*. See bull-serverless.ts.
 */
@Module({
  imports: [DiscoveryModule],
  controllers: [ServerlessController],
  providers: [CronRunnerService, QueueDrainService],
})
export class ServerlessModule {}
