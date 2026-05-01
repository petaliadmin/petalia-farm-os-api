import { Injectable, BadRequestException, Inject } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { Parcelle } from "../parcelles/entities/parcelle.entity";
import { NdviData } from "../ndvi/entities/ndvi-data.entity";

interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface FeatureCollection {
  type: "FeatureCollection";
  features: unknown[];
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const STATUT_COLORS: Record<string, string> = {
  sain: "#22c55e",
  attention: "#f59e0b",
  urgent: "#ef4444",
  recolte: "#8b5cf6",
};

@Injectable()
export class MapService {
  constructor(
    @InjectRepository(Parcelle) private parcellesRepo: Repository<Parcelle>,
    @InjectRepository(NdviData) private ndviRepo: Repository<NdviData>,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async parcellesGeoJson(
    bbox: string | undefined,
    organisationId: string | null,
  ): Promise<FeatureCollection> {
    const box = this.parseBBox(bbox);
    const key = `map:parcelles:${organisationId ?? "all"}:${bbox ?? "world"}`;
    const cached = await this.cache.get<FeatureCollection>(key);
    if (cached) return cached;

    const qb = this.parcellesRepo
      .createQueryBuilder("p")
      .where("p.deleted = false")
      .andWhere("p.boundary IS NOT NULL");

    if (organisationId) {
      qb.andWhere("p.organisationId = :org", { org: organisationId });
    }
    if (box) {
      qb.andWhere(
        `(p.centroid->'coordinates'->>0)::float BETWEEN :minLng AND :maxLng`,
        box,
      ).andWhere(
        `(p.centroid->'coordinates'->>1)::float BETWEEN :minLat AND :maxLat`,
        box,
      );
    }

    const parcelles = await qb.getMany();
    const fc: FeatureCollection = {
      type: "FeatureCollection",
      features: parcelles.map((p) => ({
        type: "Feature",
        geometry: p.boundary,
        properties: {
          id: p.id,
          code: p.code,
          nom: p.nom,
          culture: p.culture,
          stade: p.stade,
          statut: p.statut,
          superficie: p.superficie,
          healthScore: p.healthScore,
          color: STATUT_COLORS[p.statut] ?? "#9ca3af",
        },
      })),
    };
    await this.cache.set(key, fc, CACHE_TTL_MS);
    return fc;
  }

  /**
   * Server-side grid clustering. Groups parcelles by rounded centroid
   * (precision = 1 / gridSize degrees), returns one Point per cluster
   * with count + AVG NDVI.
   */
  async clusters(
    bbox: string | undefined,
    organisationId: string | null,
    gridSize: number,
  ): Promise<FeatureCollection> {
    if (gridSize < 4 || gridSize > 200) {
      throw new BadRequestException("gridSize ∈ [4, 200]");
    }
    const box = this.parseBBox(bbox);
    const key = `map:clusters:${organisationId ?? "all"}:${bbox ?? "world"}:${gridSize}`;
    const cached = await this.cache.get<FeatureCollection>(key);
    if (cached) return cached;

    const params: Record<string, unknown> = { gridSize };
    let where = "p.deleted = false AND p.centroid IS NOT NULL";
    if (organisationId) {
      where += ' AND p."organisationId" = :org';
      params.org = organisationId;
    }
    if (box) {
      where +=
        " AND (p.centroid->'coordinates'->>0)::float BETWEEN :minLng AND :maxLng" +
        " AND (p.centroid->'coordinates'->>1)::float BETWEEN :minLat AND :maxLat";
      Object.assign(params, box);
    }

    const rows: {
      lng_bucket: string;
      lat_bucket: string;
      count: string;
      avg_health: string;
      sum_superficie: string;
    }[] = await this.parcellesRepo
      .createQueryBuilder("p")
      .select(
        "FLOOR((p.centroid->'coordinates'->>0)::float * :gridSize) / :gridSize",
        "lng_bucket",
      )
      .addSelect(
        "FLOOR((p.centroid->'coordinates'->>1)::float * :gridSize) / :gridSize",
        "lat_bucket",
      )
      .addSelect("COUNT(*)", "count")
      .addSelect("AVG(p.healthScore)", "avg_health")
      .addSelect("SUM(p.superficie)", "sum_superficie")
      .where(where, params)
      .groupBy("lng_bucket")
      .addGroupBy("lat_bucket")
      .getRawMany();

    const fc: FeatureCollection = {
      type: "FeatureCollection",
      features: rows.map((r) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [
            Number(r.lng_bucket) + 0.5 / gridSize,
            Number(r.lat_bucket) + 0.5 / gridSize,
          ],
        },
        properties: {
          count: Number(r.count),
          avgHealthScore: Number(Number(r.avg_health).toFixed(2)),
          sumSuperficieHa: Number(Number(r.sum_superficie).toFixed(1)),
        },
      })),
    };
    await this.cache.set(key, fc, CACHE_TTL_MS);
    return fc;
  }

  /**
   * NDVI heatmap — one Point per parcelle with last 30-day mean NDVI
   * and a colour ramp (red=stress, yellow=alerte, green=sain).
   */
  async ndviHeatmap(
    bbox: string | undefined,
    organisationId: string | null,
  ): Promise<FeatureCollection> {
    const box = this.parseBBox(bbox);
    const key = `map:ndvi-heatmap:${organisationId ?? "all"}:${bbox ?? "world"}`;
    const cached = await this.cache.get<FeatureCollection>(key);
    if (cached) return cached;

    const params: Record<string, unknown> = {};
    let extra = "";
    if (organisationId) {
      extra += ' AND p."organisationId" = :org';
      params.org = organisationId;
    }
    if (box) {
      extra +=
        " AND (p.centroid->'coordinates'->>0)::float BETWEEN :minLng AND :maxLng" +
        " AND (p.centroid->'coordinates'->>1)::float BETWEEN :minLat AND :maxLat";
      Object.assign(params, box);
    }

    const rows: {
      id: string;
      code: string;
      lng: string;
      lat: string;
      ndvi: string;
    }[] = await this.parcellesRepo
      .createQueryBuilder("p")
      .innerJoin(
        (qb) =>
          qb
            .select('n."parcelleId"', "pid")
            .addSelect('AVG(n."ndviMoyen")', "ndvi")
            .from(NdviData, "n")
            .where("n.date >= NOW() - INTERVAL '30 days'")
            .groupBy('n."parcelleId"'),
        "n",
        'n.pid = p.id',
      )
      .select("p.id", "id")
      .addSelect("p.code", "code")
      .addSelect("(p.centroid->'coordinates'->>0)::float", "lng")
      .addSelect("(p.centroid->'coordinates'->>1)::float", "lat")
      .addSelect("n.ndvi", "ndvi")
      .where("p.deleted = false")
      .andWhere("p.centroid IS NOT NULL")
      .andWhere("1=1" + extra, params)
      .getRawMany();

    const fc: FeatureCollection = {
      type: "FeatureCollection",
      features: rows.map((r) => {
        const ndvi = Number(r.ndvi);
        return {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [Number(r.lng), Number(r.lat)],
          },
          properties: {
            parcelleId: r.id,
            code: r.code,
            ndvi: Number(ndvi.toFixed(3)),
            color: this.ndviColor(ndvi),
            classe:
              ndvi < 0.3 ? "stress" : ndvi < 0.6 ? "attention" : "sain",
          },
        };
      }),
    };
    await this.cache.set(key, fc, CACHE_TTL_MS);
    return fc;
  }

  private parseBBox(bbox: string | undefined): BBox | null {
    if (!bbox) return null;
    const parts = bbox.split(",").map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
      throw new BadRequestException(
        "bbox format: minLng,minLat,maxLng,maxLat",
      );
    }
    const [minLng, minLat, maxLng, maxLat] = parts;
    return { minLng, minLat, maxLng, maxLat };
  }

  private ndviColor(ndvi: number): string {
    if (ndvi < 0.2) return "#7f1d1d";
    if (ndvi < 0.3) return "#dc2626";
    if (ndvi < 0.45) return "#f59e0b";
    if (ndvi < 0.6) return "#facc15";
    if (ndvi < 0.75) return "#84cc16";
    return "#15803d";
  }
}
