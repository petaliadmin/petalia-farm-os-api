import { Injectable, Inject } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { Visite } from "../visites/entities/visite.entity";
import { Tache } from "../taches/entities/tache.entity";
import { Recolte } from "../recoltes/entities/recolte.entity";
import { Parcelle } from "../parcelles/entities/parcelle.entity";
import { Mouvement } from "../intrants/entities/mouvement.entity";
import { Intrant } from "../intrants/entities/intrant.entity";

const KPIS_TTL_MS = 10 * 60 * 1000;
const GRAPHIQUES_TTL_MS = 30 * 60 * 1000;

const CULTURE_TARGETS: Record<string, { objectif: number; emoji: string }> = {
  riz: { objectif: 5.0, emoji: "🌾" },
  arachide: { objectif: 1.5, emoji: "🥜" },
  mais: { objectif: 4.0, emoji: "🌽" },
  oignon: { objectif: 20.0, emoji: "🧅" },
  tomate: { objectif: 25.0, emoji: "🍅" },
  mil: { objectif: 1.0, emoji: "🌿" },
};

type Periode = "semaine" | "mois" | "saison";

@Injectable()
export class RapportsService {
  constructor(
    @InjectRepository(Visite) private visitesRepo: Repository<Visite>,
    @InjectRepository(Tache) private tachesRepo: Repository<Tache>,
    @InjectRepository(Recolte) private recoltesRepo: Repository<Recolte>,
    @InjectRepository(Parcelle) private parcellesRepo: Repository<Parcelle>,
    @InjectRepository(Mouvement) private mouvementsRepo: Repository<Mouvement>,
    @InjectRepository(Intrant) private intrantsRepo: Repository<Intrant>,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async getKpis(
    periode: Periode = "mois",
    organisationId: string | null,
  ) {
    const key = `rapports:kpis:${organisationId ?? "all"}:${periode}`;
    const cached = await this.cache.get(key);
    if (cached) return { data: cached, cached: true };

    const interval = this.intervalFor(periode);

    const orgFilter = organisationId
      ? { organisationId }
      : {};

    const [
      visitesRealisees,
      tachesClosees,
      recoltesAgg,
      coutIntrantsAgg,
      haCouvertesAgg,
      tachesTotal,
      tachesAlertesResolues,
    ] = await Promise.all([
      this.visitesRepo
        .createQueryBuilder("v")
        .where("v.statut = :s", { s: "completee" })
        .andWhere(`v.date >= NOW() - INTERVAL '${interval}'`)
        .andWhere(
          organisationId ? "v.organisationId = :org" : "1=1",
          organisationId ? { org: organisationId } : {},
        )
        .getCount(),

      this.tachesRepo
        .createQueryBuilder("t")
        .where("t.statut = :s", { s: "done" })
        .andWhere(`t.dateTerminee >= NOW() - INTERVAL '${interval}'`)
        .andWhere(
          organisationId ? "t.organisationId = :org" : "1=1",
          organisationId ? { org: organisationId } : {},
        )
        .getCount(),

      this.recoltesRepo
        .createQueryBuilder("r")
        .select("AVG(r.rendement)", "rendementMoyen")
        .where("r.statut = :s", { s: "validee" })
        .andWhere(`r.dateRecolte >= NOW() - INTERVAL '${interval}'`)
        .andWhere(
          organisationId ? "r.organisationId = :org" : "1=1",
          organisationId ? { org: organisationId } : {},
        )
        .getRawOne(),

      this.mouvementsRepo
        .createQueryBuilder("m")
        .innerJoin(Intrant, "i", "i.id = m.intrantId")
        .select("SUM(m.quantite * COALESCE(i.prixUnitaire, 0))", "cout")
        .where("m.type = :t", { t: "sortie" })
        .andWhere(`m.date >= NOW() - INTERVAL '${interval}'`)
        .andWhere(
          organisationId ? "i.organisationId = :org" : "1=1",
          organisationId ? { org: organisationId } : {},
        )
        .getRawOne(),

      this.parcellesRepo
        .createQueryBuilder("p")
        .select("SUM(p.superficie)", "ha")
        .innerJoin(Visite, "v", "v.parcelleId = p.id")
        .where("p.deleted = false")
        .andWhere("v.statut = :s", { s: "completee" })
        .andWhere(`v.date >= NOW() - INTERVAL '${interval}'`)
        .andWhere(
          organisationId ? "p.organisationId = :org" : "1=1",
          organisationId ? { org: organisationId } : {},
        )
        .getRawOne(),

      this.tachesRepo
        .createQueryBuilder("t")
        .where("t.priorite IN (:...prios)", { prios: ["haute", "urgente"] })
        .andWhere(`t.createdAt >= NOW() - INTERVAL '${interval}'`)
        .andWhere(
          organisationId ? "t.organisationId = :org" : "1=1",
          organisationId ? { org: organisationId } : {},
        )
        .getCount(),

      this.tachesRepo
        .createQueryBuilder("t")
        .where("t.priorite IN (:...prios)", { prios: ["haute", "urgente"] })
        .andWhere("t.statut = :s", { s: "done" })
        .andWhere(`t.createdAt >= NOW() - INTERVAL '${interval}'`)
        .andWhere(
          organisationId ? "t.organisationId = :org" : "1=1",
          organisationId ? { org: organisationId } : {},
        )
        .getCount(),
    ]);

    void orgFilter;

    const data = {
      visitesRealisees,
      haCouvertes: Math.round(Number(haCouvertesAgg?.ha ?? 0)),
      tachesClosees,
      coutIntrants: Math.round(Number(coutIntrantsAgg?.cout ?? 0)),
      rendementMoyen: Number(
        Number(recoltesAgg?.rendementMoyen ?? 0).toFixed(2),
      ),
      tauxAlertesResolues:
        tachesTotal > 0
          ? Math.round((tachesAlertesResolues / tachesTotal) * 100)
          : 0,
    };

    await this.cache.set(key, data, KPIS_TTL_MS);
    return { data, cached: false };
  }

  async getGraphiques(organisationId: string | null) {
    const key = `rapports:graphiques:${organisationId ?? "all"}`;
    const cached = await this.cache.get(key);
    if (cached) return { data: cached, cached: true };

    const orgClause = organisationId ? "r.organisationId = :org" : "1=1";
    const orgParams = organisationId ? { org: organisationId } : {};

    const [rendementRows, problemesRows, activiteRows] = await Promise.all([
      this.recoltesRepo
        .createQueryBuilder("r")
        .innerJoin(Parcelle, "p", "p.id = r.parcelleId")
        .select("p.culture", "culture")
        .addSelect("AVG(r.rendement)", "rendement")
        .where("r.statut = :s", { s: "validee" })
        .andWhere("r.dateRecolte >= NOW() - INTERVAL '6 months'")
        .andWhere(orgClause, orgParams)
        .groupBy("p.culture")
        .getRawMany(),

      this.visitesRepo
        .createQueryBuilder("v")
        .select("v.etatGeneral", "type")
        .addSelect("COUNT(*)", "count")
        .where("v.etatGeneral IS NOT NULL")
        .andWhere("v.etatGeneral <> 'normale'")
        .andWhere("v.date >= NOW() - INTERVAL '3 months'")
        .andWhere(
          organisationId ? "v.organisationId = :org" : "1=1",
          organisationId ? { org: organisationId } : {},
        )
        .groupBy("v.etatGeneral")
        .orderBy("count", "DESC")
        .limit(5)
        .getRawMany(),

      this.visitesRepo.query(
        `SELECT TO_CHAR(v.date, 'IYYY-"S"IW') AS semaine,
                COUNT(*) FILTER (WHERE v.statut = 'completee')::int AS visites,
                COALESCE((SELECT COUNT(*)::int FROM taches t
                          WHERE TO_CHAR(t.createdAt, 'IYYY-"S"IW') = TO_CHAR(v.date, 'IYYY-"S"IW')
                          ${organisationId ? "AND t.organisationId = $1" : ""}), 0) AS taches
         FROM visites v
         WHERE v.date >= NOW() - INTERVAL '4 weeks'
         ${organisationId ? "AND v.organisationId = $1" : ""}
         GROUP BY semaine
         ORDER BY semaine`,
        organisationId ? [organisationId] : [],
      ),
    ]);

    const rendementParCulture = rendementRows
      .filter((r) => r.culture)
      .map((r) => {
        const target = CULTURE_TARGETS[r.culture] ?? {
          objectif: 0,
          emoji: "🌱",
        };
        return {
          culture: this.capitalize(r.culture),
          rendement: Number(Number(r.rendement).toFixed(2)),
          objectif: target.objectif,
          emoji: target.emoji,
        };
      });

    const topProblemes = problemesRows.map((p) => ({
      nom: this.capitalize(p.type),
      count: Number(p.count),
      type: p.type,
    }));

    const activiteMensuelle = activiteRows.map(
      (r: { semaine: string; visites: number; taches: number }) => ({
        semaine: r.semaine.split("-").pop() ?? r.semaine,
        visites: Number(r.visites),
        taches: Number(r.taches),
      }),
    );

    const data = { rendementParCulture, topProblemes, activiteMensuelle };
    await this.cache.set(key, data, GRAPHIQUES_TTL_MS);
    return { data, cached: false };
  }

  async exportRapport(_data: {
    format: string;
    type: string;
    periode: string;
  }) {
    // Sprint 5.1: PDF generation will move to a Bull worker (PDFKit)
    return {
      data: {
        url: null,
        nom: `Rapport_${_data.type}_${new Date().toISOString().slice(0, 10)}.${_data.format}`,
        status: "not_implemented",
        message: "Export PDF différé au Sprint 5.1 (worker Bull)",
      },
    };
  }

  async getEconomiques(organisationId: string | null) {
    const key = `rapports:eco:${organisationId ?? "all"}`;
    const cached = await this.cache.get(key);
    if (cached) return { data: cached, cached: true };

    const orgClauseR = organisationId ? "r.organisationId = :org" : "1=1";
    const orgClauseI = organisationId ? "i.organisationId = :org" : "1=1";
    const orgParams = organisationId ? { org: organisationId } : {};

    const [recettesRow, depensesRow, rendementRow] = await Promise.all([
      this.recoltesRepo
        .createQueryBuilder("r")
        .select("SUM(r.revenuTotal)", "total")
        .where("r.statut = :s", { s: "validee" })
        .andWhere("r.dateRecolte >= NOW() - INTERVAL '12 months'")
        .andWhere(orgClauseR, orgParams)
        .getRawOne(),

      this.mouvementsRepo
        .createQueryBuilder("m")
        .innerJoin(Intrant, "i", "i.id = m.intrantId")
        .select("SUM(m.quantite * COALESCE(i.prixUnitaire, 0))", "total")
        .where("m.type = :t", { t: "sortie" })
        .andWhere("m.date >= NOW() - INTERVAL '12 months'")
        .andWhere(orgClauseI, orgParams)
        .getRawOne(),

      this.recoltesRepo
        .createQueryBuilder("r")
        .select("AVG(r.rendement)", "avg")
        .where("r.statut = :s", { s: "validee" })
        .andWhere("r.dateRecolte >= NOW() - INTERVAL '12 months'")
        .andWhere(orgClauseR, orgParams)
        .getRawOne(),
    ]);

    const totalRecettes = Math.round(Number(recettesRow?.total ?? 0));
    const totalDepenses = Math.round(Number(depensesRow?.total ?? 0));
    const data = {
      totalRecettes,
      totalDepenses,
      marge: totalRecettes - totalDepenses,
      rendementMoyen: Number(Number(rendementRow?.avg ?? 0).toFixed(2)),
    };

    await this.cache.set(key, data, KPIS_TTL_MS);
    return { data, cached: false };
  }

  private intervalFor(periode: Periode): string {
    switch (periode) {
      case "semaine":
        return "7 days";
      case "saison":
        return "6 months";
      case "mois":
      default:
        return "30 days";
    }
  }

  private capitalize(s: string | null): string {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }
}
