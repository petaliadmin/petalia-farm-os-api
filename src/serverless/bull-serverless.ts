import Bull from "bull";

/**
 * Queues that received a processor through @Process, i.e. the ones the
 * drain endpoint has to empty.
 */
export const processedQueues = new Set<Bull.Queue>();

let installed = false;

/**
 * On Vercel, @nestjs/bull would call queue.process() at boot, which starts a
 * blocking BRPOPLPUSH loop per queue. A frozen function cannot run it: jobs
 * get picked up and then stall, and the loop burns Redis commands.
 *
 * This keeps the handler registration (so @Process methods and their DI stay
 * untouched) but skips the polling loop. Jobs are then processed by
 * QueueDrainService, called by Vercel Cron.
 *
 * Must run before the Nest application is created.
 */
export function installServerlessBullPatch(): void {
  if (installed) return;
  installed = true;

  const proto = Bull.prototype as Bull.Queue & {
    setHandler(name: string, handler: unknown): void;
  };

  proto.process = function (this: typeof proto, ...args: unknown[]) {
    const handler = args.pop();
    // Same default name as Bull's Job.DEFAULT_JOB_NAME.
    const name = typeof args[0] === "string" ? args[0] : "__default__";
    this.setHandler(name, handler);
    processedQueues.add(this);
    return Promise.resolve();
  } as Bull.Queue["process"];
}
