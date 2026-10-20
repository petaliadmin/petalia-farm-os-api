import { Injectable, Logger } from "@nestjs/common";
import { Job, Queue } from "bull";
import { processedQueues } from "./bull-serverless";

// Bull's own Lua wrapper that moves due delayed jobs back to "wait".
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bullScripts = require("bull/lib/scripts") as {
  updateDelaySet(queue: Queue, timestamp: number): Promise<unknown>;
};

/** Bull internals used for manual processing (see bull/lib/queue.js). */
type DrainableQueue = Queue & {
  drained: boolean;
  getNextJob(): Promise<Job | null | undefined>;
  processJob(job: Job, notFetch?: boolean): Promise<unknown>;
  moveUnlockedJobsToWait(): Promise<unknown>;
};

export interface DrainReport {
  queue: string;
  processed: number;
}

/**
 * Processes queued Bull jobs inside a single serverless invocation, until the
 * queues are empty or the time budget is spent. Jobs left over are picked up
 * by the next run: retries, backoff and failure handling stay Bull's.
 */
@Injectable()
export class QueueDrainService {
  private readonly logger = new Logger(QueueDrainService.name);

  async drain(budgetMs: number): Promise<DrainReport[]> {
    const deadline = Date.now() + budgetMs;
    const report: DrainReport[] = [];

    for (const queue of processedQueues as Set<DrainableQueue>) {
      let processed = 0;
      await queue.isReady();
      // Long-running instances do this on timers; here once per drain.
      await queue.moveUnlockedJobsToWait();
      // Delayed jobs (backoff retries) whose time has come.
      await bullScripts.updateDelaySet(queue, Date.now());

      while (Date.now() < deadline) {
        // drained=false makes getNextJob non-blocking (no BRPOPLPUSH wait).
        queue.drained = false;
        const job = await queue.getNextJob();
        if (!job) break;
        await queue.processJob(job, true);
        processed++;
      }

      report.push({ queue: queue.name, processed });
      if (processed > 0) {
        this.logger.log(`Drained ${processed} job(s) from "${queue.name}"`);
      }
    }
    return report;
  }
}
