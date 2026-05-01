import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  SatelliteIndex,
  SatelliteIndexCode,
} from "./entities/satellite-index.entity";
import { Parcelle } from "../parcelles/entities/parcelle.entity";
import { SentinelStatsClient } from "./sentinel-stats.client";
import { INDEX_CODES } from "./evalscripts";

const VALID_CODES = new Set<string>(INDEX_CODES);
const MAX_DAYS = 180;

/**
 * Index → producer-friendly classification thresholds.
 * Sources : ESA & Petalia agronomic guidelines, simplified for Sahel context.
 */
const CLASS_THRESHOLDS: Record<
  SatelliteIndexCode,
  { stress: number; alert: number; ok: number }
> = {
  ndvi: { stress: 0.3, alert: 0.5, ok: 0.7 },
  evi: { stress: 0.2, alert: 0.4, ok: 0.6 },
  savi: { stress: 0.2, alert: 0.4, ok: 0.6 },
  ndwi: { stress: 0.0, alert: 0.2, ok: 0.4 },
  lai: { stress: 0.5, alert: 1.5, ok: 3.0 },
};

@Injectable()
export class SatelliteService {
  private readonly logger = new Logger(SatelliteService.name);

  constructor(
    @InjectRepository(SatelliteIndex)
    private indexRepo: Repository<SatelliteIndex>,
    @InjectRepository(Parcelle)
    private parcellesRepo: Repository<Parcelle>,
    private sentinel: SentinelStatsClient,
  ) {}

  /**
   * Synchronous fetch of an index over a time range. Persists rows
   * (idempotent via unique constraint parcelleId+indexCode+date).
   */
  async fetchIndex(
    parcelleId: string,
    indexCode: SatelliteIndexCode,
    fromIso: string,
    toIso: string,
    organisationId: string | null,
  ): Promise<{ samples: number; rows: SatelliteIndex[] }> {
    if (!VALID_CODES.has(indexCode)) {
      throw new BadRequestException(
        `Index inconnu: ${indexCode}. Valides: ${INDEX_CODES.join(",")}`,
      );
    }
    const from = new Date(fromIso);
    const to = new Date(toIso);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException("Format ISO invalide pour from/to");
    }
    if (to <= from) {
      throw new BadRequestException("'to' doit être > 'from'");
    }
    const days = (to.getTime() - from.getTime()) / 86_400_000;
    if (days > MAX_DAYS) {
      throw new BadRequestException(
        `Plage > ${MAX_DAYS} jours non supportée (limite Sentinel Hub)`,
      );
    }

    const parcelle = await this.parcellesRepo.findOne({
      where: { id: parcelleId, deleted: false },
    });
    if (!parcelle) throw new NotFoundException("Parcelle introuvable");
    if (
      organisationId &&
      parcelle.organisationId &&
      parcelle.organisationId !== organisationId
    ) {
      throw new NotFoundException("Parcelle introuvable");
    }
    const boundary = parcelle.boundary as
      | { type: "Polygon"; coordinates: number[][][] }
      | null;
    if (!boundary || boundary.type !== "Polygon") {
      throw new BadRequestException("Parcelle sans polygon valide");
    }

    const stats = await this.sentinel.fetchIndex(
      indexCode,
      boundary,
      from.toISOString(),
      to.toISOString(),
    );
    if (stats.length === 0) {
      this.logger.warn(`No ${indexCode} samples for parcelle ${parcelleId}`);
      return { samples: 0, rows: [] };
    }

    const rows = stats.map((s) =>
      this.indexRepo.create({
        parcelleId,
        indexCode,
        date: s.date,
        meanValue: s.mean,
        minValue: s.min,
        maxValue: s.max,
        stddev: s.stddev,
      }),
    );
    // Upsert via ON CONFLICT — rerun on same window doesn't duplicate.
    await this.indexRepo
      .createQueryBuilder()
      .insert()
      .values(rows)
      .orIgnore()
      .execute();

    return { samples: rows.length, rows };
  }

  /**
   * Read-back over a window. Optionally filter by indexCode list.
   */
  async listForParcelle(
    parcelleId: string,
    indices: SatelliteIndexCode[],
    organisationId: string | null,
  ): Promise<
    Record<
      SatelliteIndexCode,
      { date: string; mean: number; classe: string }[]
    >
  > {
    const parcelle = await this.parcellesRepo.findOne({
      where: { id: parcelleId, deleted: false },
      select: ["id", "organisationId"],
    });
    if (!parcelle) throw new NotFoundException("Parcelle introuvable");
    if (
      organisationId &&
      parcelle.organisationId &&
      parcelle.organisationId !== organisationId
    ) {
      throw new NotFoundException("Parcelle introuvable");
    }

    const codes = indices.length ? indices : INDEX_CODES;
    const rows = await this.indexRepo.find({
      where: { parcelleId },
      order: { date: "DESC" },
      take: 365,
    });

    const out = Object.fromEntries(
      codes.map((c) => [c, [] as { date: string; mean: number; classe: string }[]]),
    ) as Record<
      SatelliteIndexCode,
      { date: string; mean: number; classe: string }[]
    >;
    for (const r of rows) {
      if (!codes.includes(r.indexCode)) continue;
      out[r.indexCode].push({
        date: r.date.toISOString().slice(0, 10),
        mean: r.meanValue,
        classe: this.classify(r.indexCode, r.meanValue),
      });
    }
    return out;
  }

  classify(indexCode: SatelliteIndexCode, value: number): string {
    const t = CLASS_THRESHOLDS[indexCode];
    if (value < t.stress) return "stress";
    if (value < t.alert) return "attention";
    if (value < t.ok) return "correct";
    return "sain";
  }
}
