import { InjectQueue } from "@nestjs/bull";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Queue } from "bull";
import { In, Repository } from "typeorm";
import { QUEUE_NAMES } from "../../common/queues";
import { NdviData } from "../../ndvi/entities/ndvi-data.entity";
import { Parcelle } from "../../parcelles/entities/parcelle.entity";
import { PublicClient } from "../common/context";
import { decodeId } from "../common/ids";
import { presentJob, presentObservation } from "../common/presenters";
import { ProblemException } from "../common/problem";
import { ApiJob } from "../entities/api-job.entity";
import { Observation } from "../entities/observation.entity";
import { EventsService } from "../events/events.service";
import { ParcelsService } from "../parcels/parcels.service";

export const API_JOB_PREFIX = "api-job:";

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectRepository(ApiJob) private readonly jobs: Repository<ApiJob>,
    @InjectRepository(NdviData) private readonly ndvi: Repository<NdviData>,
    @InjectRepository(Observation)
    private readonly observations: Repository<Observation>,
    @InjectRepository(Parcelle)
    private readonly parcelRepo: Repository<Parcelle>,
    @InjectQueue(QUEUE_NAMES.NDVI) private readonly ndviQueue: Queue,
    private readonly parcels: ParcelsService,
    private readonly events: EventsService,
  ) {}

  /** Sentinel-2 NDVI over the last 30 days, computed by the NDVI worker. */
  async startNdvi(client: PublicClient, parcelId: string) {
    const { parcel } = await this.parcels.loadParcel(
      client,
      parcelId,
      "parcels:read",
    );
    if (!parcel.boundary) {
      throw new ProblemException("invalid_geometry", {
        params: { reason: "this parcel has no geometry to analyse" },
      });
    }
    const job = await this.jobs.save(
      this.jobs.create({
        livemode: client.livemode,
        organisationId: client.organizationId,
        type: "ndvi_analysis",
        status: "queued",
        parcelleId: parcel.id,
      }),
    );

    if (!client.livemode) return presentJob(await this.simulate(job, parcel));

    const queued = await this.ndviQueue.add(
      "fetch",
      { parcelleId: parcel.id, daysBack: 30 },
      { jobId: `${API_JOB_PREFIX}${job.id}` },
    );
    job.queueJobId = String(queued.id);
    return presentJob(await this.jobs.save(job));
  }

  async retrieve(client: PublicClient, id: string) {
    let job = await this.jobs.findOne({
      where: {
        id: decodeId("job", id),
        organisationId: client.organizationId,
        livemode: client.livemode,
      },
    });
    if (!job)
      throw new ProblemException("resource_missing", { params: { id } });
    if (
      (job.status === "queued" || job.status === "running") &&
      job.queueJobId
    ) {
      job = await this.refresh(job);
    }
    return presentJob(job);
  }

  /** Called by the queue listener and lazily on polling. */
  async onQueueJobFinished(queueJobId: string, failedReason?: string) {
    const job = await this.jobs.findOne({ where: { queueJobId } });
    if (!job) return;
    if (failedReason !== undefined) await this.fail(job, failedReason);
    else await this.succeed(job);
  }

  private async refresh(job: ApiJob): Promise<ApiJob> {
    const queued = await this.ndviQueue.getJob(job.queueJobId!);
    if (!queued) return job;
    const state = await queued.getState();
    if (state === "completed") await this.succeed(job);
    else if (state === "failed")
      await this.fail(job, queued.failedReason ?? "failed");
    else if (state === "active" && job.status === "queued") {
      await this.jobs.update(job.id, { status: "running" });
    }
    return (await this.jobs.findOne({ where: { id: job.id } }))!;
  }

  private async succeed(job: ApiJob) {
    const latest = await this.ndvi.findOne({
      where: { parcelleId: job.parcelleId! },
      order: { date: "DESC" },
    });
    const result = latest
      ? {
          ndvi: {
            mean: latest.ndviMoyen,
            min: latest.ndviMin ?? null,
            max: latest.ndviMax ?? null,
            unit: "1",
          },
          acquired_on: new Date(latest.date).toISOString().slice(0, 10),
          cloud_coverage:
            latest.cloudCoverage === null || latest.cloudCoverage === undefined
              ? null
              : { value: latest.cloudCoverage, unit: "%" },
          source: latest.source,
        }
      : { ndvi: null };
    if (!(await this.transition(job, "succeeded", { result }))) return;

    let observation: Observation | null = null;
    if (latest)
      observation = await this.recordSatelliteObservation(
        job,
        latest.ndviMoyen,
        latest.date,
      );
    const body = presentJob({
      ...job,
      status: "succeeded",
      result,
      completedAt: new Date(),
    });
    void this.events.emit(job.organisationId, job.livemode, "job.succeeded", {
      ...body,
      observation: observation ? presentObservation(observation).id : null,
    });
  }

  private async fail(job: ApiJob, reason: string) {
    const error = { code: "processing_failed", message: reason.slice(0, 500) };
    if (!(await this.transition(job, "failed", { error }))) return;
    void this.events.emit(
      job.organisationId,
      job.livemode,
      "job.failed",
      presentJob({ ...job, status: "failed", error, completedAt: new Date() }),
    );
  }

  /** Compare-and-set so the listener and a poll never complete a job twice. */
  private async transition(
    job: ApiJob,
    status: "succeeded" | "failed",
    patch: Partial<ApiJob>,
  ): Promise<boolean> {
    const { affected } = await this.jobs.update(
      { id: job.id, status: In(["queued", "running"]) },
      { status, completedAt: new Date(), ...patch },
    );
    return Boolean(affected);
  }

  /** NDVI also lands in the unified observation stream (source: satellite). */
  private async recordSatelliteObservation(
    job: ApiJob,
    value: number,
    at: Date,
  ) {
    const parcel = await this.parcelRepo.findOne({
      where: { id: job.parcelleId! },
    });
    return this.observations.save(
      this.observations.create({
        livemode: job.livemode,
        organisationId: parcel?.organisationId ?? job.organisationId,
        parcelleId: job.parcelleId,
        deviceId: null,
        sourceType: "satellite",
        property: "ndvi",
        value,
        unit: "1",
        observedAt: new Date(at),
        quality: "validated",
        location: (parcel?.centroid as Observation["location"]) ?? null,
        metadata: { provider: "sentinel-2" },
      }),
    );
  }

  /** Sandbox: deterministic, instant result, no satellite call. */
  private async simulate(job: ApiJob, parcel: Parcelle): Promise<ApiJob> {
    const seed =
      parseInt(parcel.id.replace(/-/g, "").slice(0, 6), 16) / 0xffffff;
    const mean = Math.round((0.35 + seed * 0.4) * 1000) / 1000;
    await this.ndvi.save(
      this.ndvi.create({
        parcelleId: parcel.id,
        date: new Date(),
        ndviMoyen: mean,
        ndviMin: Math.max(0, mean - 0.15),
        ndviMax: Math.min(1, mean + 0.12),
        source: "sandbox",
        cloudCoverage: 4,
      }),
    );
    await this.succeed(job);
    return (await this.jobs.findOne({ where: { id: job.id } }))!;
  }
}
