import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Queue } from "bull";
import { QUEUE_NAMES } from "../common/queues";
import { MetricsService } from "./metrics.service";

/**
 * Polls Bull queue depths every 15 s and pushes them as Prometheus gauges.
 * Counts (completed/failed totals) are still incremented from queue events
 * in the individual processors via @OnQueueCompleted / @OnQueueFailed.
 */
@Injectable()
export class QueueMetricsCollector {
  private readonly logger = new Logger(QueueMetricsCollector.name);

  constructor(
    private readonly metrics: MetricsService,
    @InjectQueue(QUEUE_NAMES.NDVI) private readonly ndviQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PDF) private readonly pdfQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SMS) private readonly smsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ALERTES) private readonly alertesQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WHATSAPP) private readonly whatsappQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async collect(): Promise<void> {
    const queues: Array<{ name: string; q: Queue }> = [
      { name: QUEUE_NAMES.NDVI, q: this.ndviQueue },
      { name: QUEUE_NAMES.PDF, q: this.pdfQueue },
      { name: QUEUE_NAMES.SMS, q: this.smsQueue },
      { name: QUEUE_NAMES.ALERTES, q: this.alertesQueue },
      { name: QUEUE_NAMES.WHATSAPP, q: this.whatsappQueue },
    ];

    await Promise.all(
      queues.map(async ({ name, q }) => {
        try {
          const counts = await q.getJobCounts();
          this.metrics.queueJobsWaiting.set({ queue: name }, counts.waiting);
          this.metrics.queueJobsActive.set({ queue: name }, counts.active);
        } catch (err) {
          this.logger.warn(
            `Queue metrics collection failed for ${name}: ${(err as Error).message}`,
          );
        }
      }),
    );
  }
}
