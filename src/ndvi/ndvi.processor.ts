import { Process, Processor, OnQueueFailed } from "@nestjs/bull";
import { Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Job } from "bull";
import { QUEUE_NAMES } from "../common/queues";
import { Parcelle } from "../parcelles/entities/parcelle.entity";
import { NdviData } from "./entities/ndvi-data.entity";
import { SentinelHubClient } from "./sentinel-hub.client";

export interface NdviFetchJob {
  parcelleId: string;
  daysBack?: number;
}

@Processor(QUEUE_NAMES.NDVI)
export class NdviProcessor {
  private readonly logger = new Logger(NdviProcessor.name);

  constructor(
    @InjectRepository(Parcelle)
    private parcellesRepo: Repository<Parcelle>,
    @InjectRepository(NdviData)
    private ndviRepo: Repository<NdviData>,
    private sentinelHub: SentinelHubClient,
  ) {}

  @Process("fetch")
  async fetch(job: Job<NdviFetchJob>) {
    const { parcelleId, daysBack = 30 } = job.data;
    this.logger.log(`NDVI fetch job ${job.id} → parcelle ${parcelleId}`);

    const parcelle = await this.parcellesRepo.findOne({
      where: { id: parcelleId, deleted: false },
    });
    if (!parcelle) {
      throw new NotFoundException(`Parcelle ${parcelleId} introuvable`);
    }

    const boundary = parcelle.boundary as {
      type: "Polygon";
      coordinates: number[][][];
    } | null;
    if (!boundary || boundary.type !== "Polygon") {
      throw new Error(`Parcelle ${parcelleId} sans boundary Polygon valide`);
    }

    const to = new Date();
    const from = new Date(to.getTime() - daysBack * 24 * 3600 * 1000);
    const stats = await this.sentinelHub.getNdviStats(
      boundary,
      from.toISOString(),
      to.toISOString(),
    );

    if (stats.length === 0) {
      this.logger.warn(`No NDVI samples returned for parcelle ${parcelleId}`);
      return { parcelleId, samples: 0 };
    }

    const rows = stats.map((s) =>
      this.ndviRepo.create({
        parcelleId,
        date: s.date,
        ndviMoyen: s.ndviMean,
        ndviMin: s.ndviMin,
        ndviMax: s.ndviMax,
        cloudCoverage: s.cloudCoverage,
        source: "sentinel-2",
        resolution: 10,
        zones: [],
      }),
    );
    await this.ndviRepo.save(rows);

    this.logger.log(
      `Persisted ${rows.length} NDVI samples for parcelle ${parcelleId}`,
    );
    return { parcelleId, samples: rows.length };
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(
      `NDVI job ${job.id} (${JSON.stringify(job.data)}) failed: ${err.message}`,
    );
  }
}
