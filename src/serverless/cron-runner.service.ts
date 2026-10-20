import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { DiscoveryService, MetadataScanner } from "@nestjs/core";

// Metadata key written by @Cron() (@nestjs/schedule/dist/schedule.constants,
// not exported from the package root).
const SCHEDULE_CRON_OPTIONS = "SCHEDULE_CRON_OPTIONS";

type CronHandler = () => unknown;

/**
 * Finds every @Cron() method of the application so Vercel Cron can trigger
 * it by name ("AlertesService.scanMeteoExtreme"). The schedules themselves
 * live in vercel.json; the @Cron expressions keep driving the AWS process.
 */
@Injectable()
export class CronRunnerService {
  private readonly logger = new Logger(CronRunnerService.name);
  private jobs?: Map<string, CronHandler>;

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
  ) {}

  list(): string[] {
    return [...this.registry().keys()].sort();
  }

  async run(name: string): Promise<void> {
    const job = this.registry().get(name);
    if (!job) throw new NotFoundException(`Unknown cron job "${name}"`);
    const started = Date.now();
    await job();
    this.logger.log(`Cron ${name} done in ${Date.now() - started}ms`);
  }

  private registry(): Map<string, CronHandler> {
    if (this.jobs) return this.jobs;
    this.jobs = new Map();
    for (const wrapper of this.discovery.getProviders()) {
      const { instance } = wrapper;
      if (!instance || typeof instance !== "object") continue;
      const proto = Object.getPrototypeOf(instance);
      for (const key of this.scanner.getAllMethodNames(proto)) {
        if (Reflect.getMetadata(SCHEDULE_CRON_OPTIONS, instance[key])) {
          this.jobs.set(
            `${instance.constructor.name}.${key}`,
            instance[key].bind(instance),
          );
        }
      }
    }
    return this.jobs;
  }
}
