import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Parcelle } from "../parcelles/entities/parcelle.entity";
import { NdviData } from "../ndvi/entities/ndvi-data.entity";
import { MarketPrice } from "../market/entities/market-price.entity";

@Injectable()
export class PartnerService {
  constructor(
    @InjectRepository(Parcelle) private parcellesRepo: Repository<Parcelle>,
    @InjectRepository(NdviData) private ndviRepo: Repository<NdviData>,
    @InjectRepository(MarketPrice)
    private priceRepo: Repository<MarketPrice>,
  ) {}

  async parcellesAggregated(
    organisationId: string,
    bbox: string | undefined,
  ): Promise<{
    organisationId: string;
    countParcelles: number;
    superficieTotaleHa: number;
    parRegion: { region: string; count: number; superficie: number }[];
    parCulture: { culture: string; count: number; superficie: number }[];
  }> {
    const qb = this.parcellesRepo
      .createQueryBuilder("p")
      .where("p.deleted = false")
      .andWhere("p.organisationId = :org", { org: organisationId });

    if (bbox) {
      const [minLng, minLat, maxLng, maxLat] = bbox.split(",").map(Number);
      if ([minLng, minLat, maxLng, maxLat].every((n) => !Number.isNaN(n))) {
        qb.andWhere(
          "(p.centroid->'coordinates'->>0)::float BETWEEN :minLng AND :maxLng",
          { minLng, maxLng },
        ).andWhere(
          "(p.centroid->'coordinates'->>1)::float BETWEEN :minLat AND :maxLat",
          { minLat, maxLat },
        );
      }
    }

    const total = await qb
      .clone()
      .select("COUNT(*)", "count")
      .addSelect("COALESCE(SUM(p.superficie), 0)", "superficie")
      .getRawOne<{ count: string; superficie: string }>();

    const parRegion = await qb
      .clone()
      .select("COALESCE(p.region, 'inconnu')", "region")
      .addSelect("COUNT(*)", "count")
      .addSelect("COALESCE(SUM(p.superficie), 0)", "superficie")
      .groupBy("region")
      .getRawMany<{ region: string; count: string; superficie: string }>();

    const parCulture = await qb
      .clone()
      .select("COALESCE(p.culture, 'inconnu')", "culture")
      .addSelect("COUNT(*)", "count")
      .addSelect("COALESCE(SUM(p.superficie), 0)", "superficie")
      .groupBy("culture")
      .getRawMany<{ culture: string; count: string; superficie: string }>();

    return {
      organisationId,
      countParcelles: Number(total?.count ?? 0),
      superficieTotaleHa: Number(Number(total?.superficie ?? 0).toFixed(2)),
      parRegion: parRegion.map((r) => ({
        region: r.region,
        count: Number(r.count),
        superficie: Number(Number(r.superficie).toFixed(2)),
      })),
      parCulture: parCulture.map((r) => ({
        culture: r.culture,
        count: Number(r.count),
        superficie: Number(Number(r.superficie).toFixed(2)),
      })),
    };
  }

  async ndviAggregate(
    organisationId: string,
    days: number,
  ): Promise<{
    days: number;
    parRegion: { region: string; ndviMoyen: number; parcelles: number }[];
  }> {
    const rows = await this.ndviRepo
      .createQueryBuilder("n")
      .innerJoin(Parcelle, "p", "p.id = n.parcelleId")
      .select("COALESCE(p.region, 'inconnu')", "region")
      .addSelect("AVG(n.ndviMoyen)", "ndvi")
      .addSelect("COUNT(DISTINCT p.id)", "parcelles")
      .where("p.deleted = false")
      .andWhere("p.organisationId = :org", { org: organisationId })
      .andWhere("n.date >= NOW() - (:days * INTERVAL '1 day')", { days })
      .groupBy("region")
      .getRawMany<{ region: string; ndvi: string; parcelles: string }>();

    return {
      days,
      parRegion: rows.map((r) => ({
        region: r.region,
        ndviMoyen: Number(Number(r.ndvi).toFixed(3)),
        parcelles: Number(r.parcelles),
      })),
    };
  }

  async marketLatest(
    culture: string,
  ): Promise<{ culture: string; marches: { marche: string; date: string; prix: number }[] }> {
    const rows = await this.priceRepo
      .createQueryBuilder("p")
      .distinctOn(["p.marche"])
      .where("p.culture = :c", { c: culture })
      .orderBy("p.marche")
      .addOrderBy("p.date", "DESC")
      .limit(50)
      .getMany();
    return {
      culture,
      marches: rows.map((r) => ({
        marche: r.marche,
        date: r.date.toISOString().slice(0, 10),
        prix: r.prixFcfaPerKg,
      })),
    };
  }
}
