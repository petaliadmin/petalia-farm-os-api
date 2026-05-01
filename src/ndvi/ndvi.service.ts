import { Injectable, Inject, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { NdviData } from "./entities/ndvi-data.entity";
import { Parcelle } from "../parcelles/entities/parcelle.entity";
import { QUEUE_NAMES } from "../common/queues";
import { NdviFetchJob } from "./ndvi.processor";

const DASHBOARD_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class NdviService {
  private readonly logger = new Logger(NdviService.name);

  constructor(
    @InjectRepository(NdviData)
    private ndviRepo: Repository<NdviData>,
    @InjectRepository(Parcelle)
    private parcellesRepo: Repository<Parcelle>,
    @InjectQueue(QUEUE_NAMES.NDVI)
    private ndviQueue: Queue<NdviFetchJob>,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async getByParcelle(parcelleId: string): Promise<NdviData[]> {
    return this.ndviRepo.find({
      where: { parcelleId },
      order: { date: "DESC" },
      take: 20,
    });
  }

  async getLatest(parcelleId: string): Promise<NdviData | null> {
    return this.ndviRepo.findOne({
      where: { parcelleId },
      order: { date: "DESC" },
    });
  }

  async getDashboard(
    organisationId: string | null,
  ): Promise<{ zone: string; ndviMoyen: number; tendance: string }[]> {
    const key = `ndvi:dashboard:${organisationId ?? "all"}`;
    const cached =
      await this.cache.get<
        { zone: string; ndviMoyen: number; tendance: string }[]
      >(key);
    if (cached) return cached;

    const qb = this.ndviRepo
      .createQueryBuilder("n")
      .innerJoin(Parcelle, "p", "p.id = n.parcelleId")
      .select("COALESCE(p.zone, p.region, 'Inconnu')", "zone")
      .addSelect("AVG(n.ndviMoyen)", "ndviMoyen")
      .where("n.date >= NOW() - INTERVAL '30 days'")
      .andWhere("p.deleted = false")
      .groupBy("zone");

    if (organisationId) {
      qb.andWhere("p.organisationId = :org", { org: organisationId });
    }

    const rows: { zone: string; ndviMoyen: string }[] = await qb.getRawMany();
    const trends = await Promise.all(
      rows.map((r) => this.computeTrend(r.zone, organisationId)),
    );

    const result = rows.map((r, i) => ({
      zone: r.zone,
      ndviMoyen: Number(Number(r.ndviMoyen).toFixed(3)),
      tendance: trends[i],
    }));

    await this.cache.set(key, result, DASHBOARD_TTL_MS);
    return result;
  }

  getNdviClasse(ndvi: number): string {
    if (ndvi < 0.3) return "stress";
    if (ndvi < 0.6) return "attention";
    return "sain";
  }

  async fetchNdvi(
    parcelleId: string,
    organisationId: string | null,
  ): Promise<{ data: { jobId: string; status: string } }> {
    const parcelle = await this.parcellesRepo.findOne({
      where: { id: parcelleId, deleted: false },
    });
    if (!parcelle) {
      throw new NotFoundException("Parcelle introuvable");
    }
    if (
      organisationId &&
      parcelle.organisationId &&
      parcelle.organisationId !== organisationId
    ) {
      throw new NotFoundException("Parcelle introuvable");
    }

    const job = await this.ndviQueue.add(
      "fetch",
      { parcelleId, daysBack: 30 },
      { jobId: `ndvi-${parcelleId}-${Date.now()}` },
    );
    this.logger.log(`Enqueued NDVI fetch ${job.id} for parcelle ${parcelleId}`);
    return { data: { jobId: String(job.id), status: "queued" } };
  }

  private async computeTrend(
    zone: string,
    organisationId: string | null,
  ): Promise<string> {
    const qb = this.ndviRepo
      .createQueryBuilder("n")
      .innerJoin(Parcelle, "p", "p.id = n.parcelleId")
      .select("AVG(n.ndviMoyen)", "current")
      .addSelect(
        `AVG(CASE WHEN n.date < NOW() - INTERVAL '15 days' THEN n.ndviMoyen END)`,
        "previous",
      )
      .where("n.date >= NOW() - INTERVAL '30 days'")
      .andWhere("COALESCE(p.zone, p.region, 'Inconnu') = :zone", { zone })
      .andWhere("p.deleted = false");

    if (organisationId) {
      qb.andWhere("p.organisationId = :org", { org: organisationId });
    }

    const row: { current: string; previous: string } = await qb.getRawOne();
    const current = Number(row?.current ?? 0);
    const previous = Number(row?.previous ?? 0);
    const delta = current - previous;
    if (Math.abs(delta) < 0.02) return "stable";
    return delta > 0 ? "hausse" : "baisse";
  }
}
