import { OnQueueCompleted, OnQueueFailed, Processor } from "@nestjs/bull";
import { Job } from "bull";
import { QUEUE_NAMES } from "../../common/queues";
import { API_JOB_PREFIX, JobsService } from "./jobs.service";

/**
 * Listens to the existing NDVI queue (no @Process here: NdviProcessor does
 * the work) and settles public jobs as soon as the worker finishes, so
 * job.succeeded / job.failed webhooks fire without anyone polling.
 */
@Processor(QUEUE_NAMES.NDVI)
export class NdviJobListener {
  constructor(private readonly jobs: JobsService) {}

  @OnQueueCompleted()
  async onCompleted(job: Job) {
    if (!String(job.id).startsWith(API_JOB_PREFIX)) return;
    await this.jobs.onQueueJobFinished(String(job.id));
  }

  @OnQueueFailed()
  async onFailed(job: Job, err: Error) {
    if (!String(job.id).startsWith(API_JOB_PREFIX)) return;
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return; // Bull will retry
    await this.jobs.onQueueJobFinished(String(job.id), err.message);
  }
}
