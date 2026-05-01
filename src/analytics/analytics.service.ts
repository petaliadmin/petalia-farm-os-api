import { Injectable, Inject, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { Recolte } from "../recoltes/entities/recolte.entity";
import { Parcelle } from "../parcelles/entities/parcelle.entity";
import { Campagne } from "../campagnes/entities/campagne.entity";
import { Mouvement } from "../intrants/entities/mouvement.entity";
import { Intrant } from "../intrants/entities/intrant.entity";

const TTL_MS = 15 * 60 * 1000;

type Granularity = "month" | "week" | "year";

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Recolte) private recoltesRepo: Repository<Recolte>,
    @InjectRepository(Parcelle) private parcellesRepo: Repository<Parcelle>,
    @InjectRepository(Campagne) private campagnesRepo: Repository<Campagne>,
    @InjectRepository(Mouvement) private mouvementsRepo: Repository<Mouvement>,
    @InjectRepository(Intrant) private intrantsRepo: Repository<Intrant>,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async rendementsTimeseries(
    granularity: Granularity,
    organisationId: string | null,
    culture?: string,
  ) {
    if (!["month", "week", "year"].includes(granularity)) {
      throw new BadRequestException("granularity ∈ {month, week, year}");
    }
    const key = `analytics:rendements:${organisationId ?? "all"}:${granularity}:${culture ?? "all"}`;
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const trunc =
      granularity === "year"
        ? "YYYY"
        : granularity === "week"
          ? `IYYY-"W"IW`
          : "YYYY-MM";

    const qb = this.recoltesRepo
      .createQueryBuilder("r")
      .innerJoin(Parcelle, "p", "p.id = r.parcelleId")
      .select(`TO_CHAR(r.dateRecolte, '${trunc}')`, "periode")
      .addSelect("p.culture", "culture")
      .addSelect("AVG(r.rendement)", "rendementMoyen")
      .addSelect("SUM(r.quantiteRecoltee)", "quantiteTotale")
      .addSelect("COUNT(*)", "nbRecoltes")
      .where("r.statut = :s", { s: "validee" })
      .andWhere("r.dateRecolte >= NOW() - INTERVAL '36 months'")
      .groupBy("periode")
      .addGroupBy("p.culture")
      .orderBy("periode", "ASC");

    if (organisationId) {
      qb.andWhere("r.organisationId = :org", { org: organisationId });
    }
    if (culture) {
      qb.andWhere("p.culture = :c", { c: culture });
    }

    const rows: {
      periode: string;
      culture: string;
      rendementMoyen: string;
      quantiteTotale: string;
      nbRecoltes: string;
    }[] = await qb.getRawMany();

    const data = rows.map((r) => ({
      periode: r.periode,
      culture: r.culture,
      rendementMoyen: Number(Number(r.rendementMoyen).toFixed(2)),
      quantiteTotale: Number(Number(r.quantiteTotale).toFixed(0)),
      nbRecoltes: Number(r.nbRecoltes),
    }));

    await this.cache.set(key, data, TTL_MS);
    return data;
  }

  async tendanceCultures(organisationId: string | null) {
    const key = `analytics:tendance:${organisationId ?? "all"}`;
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const qb = this.recoltesRepo
      .createQueryBuilder("r")
      .innerJoin(Parcelle, "p", "p.id = r.parcelleId")
      .select("p.culture", "culture")
      .addSelect(
        `AVG(CASE WHEN r.dateRecolte >= NOW() - INTERVAL '12 months' THEN r.rendement END)`,
        "current",
      )
      .addSelect(
        `AVG(CASE WHEN r.dateRecolte >= NOW() - INTERVAL '24 months' AND r.dateRecolte < NOW() - INTERVAL '12 months' THEN r.rendement END)`,
        "previous",
      )
      .where("r.statut = :s", { s: "validee" })
      .andWhere("r.dateRecolte >= NOW() - INTERVAL '24 months'")
      .groupBy("p.culture");

    if (organisationId) {
      qb.andWhere("r.organisationId = :org", { org: organisationId });
    }

    const rows: { culture: string; current: string; previous: string }[] =
      await qb.getRawMany();

    const data = rows
      .filter((r) => r.culture)
      .map((r) => {
        const current = Number(r.current ?? 0);
        const previous = Number(r.previous ?? 0);
        const delta = current - previous;
        const pct =
          previous > 0 ? Number(((delta / previous) * 100).toFixed(1)) : null;
        return {
          culture: r.culture,
          rendementCurrent: Number(current.toFixed(2)),
          rendementPrevious: Number(previous.toFixed(2)),
          deltaTHa: Number(delta.toFixed(2)),
          deltaPct: pct,
          tendance:
            pct === null
              ? "nouveau"
              : pct > 5
                ? "hausse"
                : pct < -5
                  ? "baisse"
                  : "stable",
        };
      });

    await this.cache.set(key, data, TTL_MS);
    return data;
  }

  async margesParParcelle(organisationId: string | null, limit = 50) {
    const key = `analytics:marges:${organisationId ?? "all"}:${limit}`;
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const params = organisationId ? [organisationId, limit] : [limit];
    const limitParam = organisationId ? "$2" : "$1";

    const rows: {
      parcelleid: string;
      code: string;
      nom: string;
      culture: string;
      revenus: string;
      depenses: string;
      marge: string;
      roi_pct: string;
    }[] = await this.recoltesRepo.query(
      `WITH revenus AS (
        SELECT r."parcelleId" AS pid, COALESCE(SUM(r."revenuTotal"), 0) AS total
        FROM recoltes r
        WHERE r.statut = 'validee'
          AND r."dateRecolte" >= NOW() - INTERVAL '12 months'
        GROUP BY r."parcelleId"
      ), depenses AS (
        SELECT m."parcelleId" AS pid,
               COALESCE(SUM(m.quantite * COALESCE(i."prixUnitaire", 0)), 0) AS total
        FROM mouvements m
        INNER JOIN intrants i ON i.id = m."intrantId"
        WHERE m.type = 'sortie'
          AND m.date >= NOW() - INTERVAL '12 months'
          AND m."parcelleId" IS NOT NULL
        GROUP BY m."parcelleId"
      )
      SELECT p.id AS parcelleid, p.code, p.nom, p.culture,
             COALESCE(rev.total, 0) AS revenus,
             COALESCE(dep.total, 0) AS depenses,
             COALESCE(rev.total, 0) - COALESCE(dep.total, 0) AS marge,
             CASE WHEN COALESCE(dep.total, 0) > 0
                  THEN ROUND(((COALESCE(rev.total, 0) - COALESCE(dep.total, 0)) / dep.total * 100)::numeric, 1)
                  ELSE NULL END AS roi_pct
      FROM parcelles p
      LEFT JOIN revenus rev ON rev.pid = p.id
      LEFT JOIN depenses dep ON dep.pid = p.id
      WHERE p.deleted = false
      ${organisationId ? 'AND p."organisationId" = $1' : ""}
      ORDER BY marge DESC
      LIMIT ${limitParam}`,
      params,
    );

    const data = rows.map((r) => ({
      parcelleId: r.parcelleid,
      code: r.code,
      nom: r.nom,
      culture: r.culture,
      revenus: Math.round(Number(r.revenus)),
      depenses: Math.round(Number(r.depenses)),
      marge: Math.round(Number(r.marge)),
      roiPct: r.roi_pct == null ? null : Number(r.roi_pct),
    }));

    await this.cache.set(key, data, TTL_MS);
    return data;
  }

  async compareCampagnes(
    campagneAId: string,
    campagneBId: string,
    organisationId: string | null,
  ) {
    const [a, b] = await Promise.all([
      this.campagnesRepo.findOne({ where: { id: campagneAId } }),
      this.campagnesRepo.findOne({ where: { id: campagneBId } }),
    ]);
    if (!a || !b) {
      throw new BadRequestException("Campagne A ou B introuvable");
    }
    if (
      organisationId &&
      (a.organisationId !== organisationId ||
        b.organisationId !== organisationId)
    ) {
      throw new BadRequestException("Campagne hors scope organisation");
    }

    const summarise = async (c: Campagne) => {
      const qb = this.recoltesRepo
        .createQueryBuilder("r")
        .select("AVG(r.rendement)", "rendementMoyen")
        .addSelect("SUM(r.quantiteRecoltee)", "quantiteTotale")
        .addSelect("SUM(r.revenuTotal)", "revenusTotal")
        .addSelect("COUNT(*)", "nbRecoltes")
        .where("r.statut = :s", { s: "validee" })
        .andWhere("r.dateRecolte >= :debut", { debut: c.dateDebut });
      if (c.dateFin) {
        qb.andWhere("r.dateRecolte <= :fin", { fin: c.dateFin });
      }
      if (c.parcelleIds?.length) {
        qb.andWhere("r.parcelleId IN (:...pids)", { pids: c.parcelleIds });
      }
      const row = await qb.getRawOne();
      return {
        campagneId: c.id,
        nom: c.nom,
        type: c.type,
        rendementMoyen: Number(Number(row?.rendementMoyen ?? 0).toFixed(2)),
        quantiteTotale: Number(Number(row?.quantiteTotale ?? 0).toFixed(0)),
        revenusTotal: Math.round(Number(row?.revenusTotal ?? 0)),
        nbRecoltes: Number(row?.nbRecoltes ?? 0),
        parcellesCount: c.parcelleIds?.length ?? 0,
      };
    };

    const [sumA, sumB] = await Promise.all([summarise(a), summarise(b)]);
    return {
      campagneA: sumA,
      campagneB: sumB,
      ecart: {
        rendementMoyen: Number(
          (sumA.rendementMoyen - sumB.rendementMoyen).toFixed(2),
        ),
        quantiteTotale: sumA.quantiteTotale - sumB.quantiteTotale,
        revenusTotal: sumA.revenusTotal - sumB.revenusTotal,
      },
    };
  }
}
