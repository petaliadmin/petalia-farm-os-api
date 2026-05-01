import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import * as crypto from "crypto";

import { Parcelle } from "../parcelles/entities/parcelle.entity";
import { Tache } from "../taches/entities/tache.entity";
import { Notification } from "../notifications/entities/notification.entity";
import { MeteoService } from "../meteo/meteo.service";
import { SyncService } from "../sync/sync.service";

const DASHBOARD_TTL_MS = 90 * 1000;
const PARCELLE_LIMIT = 30;

interface DashboardWeatherZone {
  lat: number;
  lng: number;
  zoneKey: string;
  temperature: number | null;
  precipitation: number | null;
  description: string | null;
  cached: boolean;
}

export interface MobileDashboardPayload {
  serverTimestamp: string;
  cacheVersion: string;
  user: { id: string; role: string; organisationId: string | null };
  kpi: {
    parcellesActives: number;
    superficieTotaleHa: number;
    visitesEnRetard: number;
    tachesAujourdhui: number;
    alertesOuvertes: number;
    healthScoreMoyen: number;
  };
  parcelles: Array<{
    id: string;
    code: string;
    nom: string;
    culture: string | null;
    stade: string | null;
    statut: string;
    superficie: number;
    healthScore: number;
    centroid: { lat: number; lng: number } | null;
    prochaineVisite: string | null;
  }>;
  tachesAujourdhui: Array<{
    id: string;
    titre: string;
    parcelleId: string;
    priorite: string;
    statut: string;
    datePlanifiee: string | null;
  }>;
  alertes: Array<{
    id: string;
    type: string;
    titre: string;
    message: string;
    lienId: string | null;
    lienType: string | null;
    createdAt: string;
  }>;
  meteo: DashboardWeatherZone[];
}

@Injectable()
export class MobileService {
  private readonly logger = new Logger(MobileService.name);

  constructor(
    @InjectRepository(Parcelle) private parcellesRepo: Repository<Parcelle>,
    @InjectRepository(Tache) private tachesRepo: Repository<Tache>,
    @InjectRepository(Notification)
    private notifRepo: Repository<Notification>,
    @Inject(CACHE_MANAGER) private cache: Cache,
    private meteo: MeteoService,
    private sync: SyncService,
  ) {}

  async dashboard(
    userId: string,
    role: string,
    organisationId: string | null,
  ): Promise<MobileDashboardPayload> {
    const cacheKey = `mobile:dashboard:${userId}:${organisationId ?? "none"}`;
    const cached =
      await this.cache.get<MobileDashboardPayload>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const parcellesQb = this.parcellesRepo
      .createQueryBuilder("p")
      .where("p.deleted = false");
    if (organisationId) {
      parcellesQb.andWhere("p.organisationId = :org", { org: organisationId });
    }
    if (role === "technicien") {
      parcellesQb.andWhere("p.technicienId = :uid", { uid: userId });
    }
    parcellesQb
      .orderBy(
        "CASE p.statut WHEN 'urgent' THEN 0 WHEN 'attention' THEN 1 ELSE 2 END",
      )
      .addOrderBy("p.updatedAt", "DESC")
      .limit(PARCELLE_LIMIT);
    const parcelles = await parcellesQb.getMany();

    const allParcellesQb = this.parcellesRepo
      .createQueryBuilder("p")
      .where("p.deleted = false")
      .select("COUNT(*)", "total")
      .addSelect("COALESCE(SUM(p.superficie), 0)", "superficie")
      .addSelect("COALESCE(AVG(p.healthScore), 0)", "health")
      .addSelect(
        "COUNT(*) FILTER (WHERE p.prochaineVisite < NOW())",
        "lateVisits",
      );
    if (organisationId)
      allParcellesQb.andWhere("p.organisationId = :org", { org: organisationId });
    if (role === "technicien")
      allParcellesQb.andWhere("p.technicienId = :uid", { uid: userId });
    const kpiRow = await allParcellesQb.getRawOne<{
      total: string;
      superficie: string;
      health: string;
      lateVisits: string;
    }>();

    const tachesQb = this.tachesRepo
      .createQueryBuilder("t")
      .where("t.statut IN ('todo', 'en_cours')")
      .andWhere("t.datePlanifiee >= :s AND t.datePlanifiee < :e", {
        s: todayStart,
        e: todayEnd,
      });
    if (organisationId)
      tachesQb.andWhere("t.organisationId = :org", { org: organisationId });
    if (role === "technicien")
      tachesQb.andWhere("t.assigneAId = :uid", { uid: userId });
    tachesQb
      .orderBy(
        "CASE t.priorite WHEN 'urgente' THEN 0 WHEN 'haute' THEN 1 WHEN 'normale' THEN 2 ELSE 3 END",
      )
      .limit(50);
    const taches = await tachesQb.getMany();

    const alertes = await this.notifRepo
      .createQueryBuilder("n")
      .where("n.userId = :uid", { uid: userId })
      .andWhere("n.lue = false")
      .orderBy("n.createdAt", "DESC")
      .limit(20)
      .getMany();

    const meteo = await this.zoneWeather(parcelles);

    const payload: MobileDashboardPayload = {
      serverTimestamp: now.toISOString(),
      cacheVersion: "",
      user: { id: userId, role, organisationId },
      kpi: {
        parcellesActives: Number(kpiRow?.total ?? 0),
        superficieTotaleHa: Number(
          Number(kpiRow?.superficie ?? 0).toFixed(1),
        ),
        visitesEnRetard: Number(kpiRow?.lateVisits ?? 0),
        tachesAujourdhui: taches.length,
        alertesOuvertes: alertes.length,
        healthScoreMoyen: Number(Number(kpiRow?.health ?? 0).toFixed(2)),
      },
      parcelles: parcelles.map((p) => ({
        id: p.id,
        code: p.code,
        nom: p.nom,
        culture: p.culture ?? null,
        stade: p.stade ?? null,
        statut: p.statut,
        superficie: p.superficie,
        healthScore: p.healthScore,
        centroid: this.centroidLngLat(p.centroid),
        prochaineVisite: p.prochaineVisite?.toISOString() ?? null,
      })),
      tachesAujourdhui: taches.map((t) => ({
        id: t.id,
        titre: t.titre,
        parcelleId: t.parcelleId,
        priorite: t.priorite,
        statut: t.statut,
        datePlanifiee: t.datePlanifiee?.toISOString() ?? null,
      })),
      alertes: alertes.map((a) => ({
        id: a.id,
        type: a.type,
        titre: a.titre,
        message: a.message,
        lienId: a.lienId ?? null,
        lienType: a.lienType ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
      meteo,
    };

    payload.cacheVersion = this.hash(payload);
    await this.cache.set(cacheKey, payload, DASHBOARD_TTL_MS);
    return payload;
  }

  async batchSync(
    userId: string,
    role: string,
    organisationId: string | null,
    body: { since?: string; resources?: string; actions?: any[] },
  ): Promise<{
    push: { processed: number; errors: any[]; conflicts: any[] };
    pull: any;
    serverTimestamp: string;
  }> {
    void userId;
    void role;
    void organisationId;
    const actions = Array.isArray(body.actions) ? body.actions : [];
    const push = actions.length
      ? await this.sync.pushSync(actions)
      : { processed: 0, errors: [], conflicts: [], serverTimestamp: "" };
    const pull = await this.sync.pullSync(
      body.since ?? "",
      body.resources ?? "parcels,agro_rules",
    );
    return {
      push: {
        processed: push.processed,
        errors: push.errors,
        conflicts: push.conflicts,
      },
      pull,
      serverTimestamp: new Date().toISOString(),
    };
  }

  private async zoneWeather(parcelles: Parcelle[]): Promise<
    DashboardWeatherZone[]
  > {
    const zones = new Map<string, { lat: number; lng: number }>();
    for (const p of parcelles) {
      const c = this.centroidLngLat(p.centroid);
      if (!c) continue;
      const key = `${c.lat.toFixed(2)}:${c.lng.toFixed(2)}`;
      if (!zones.has(key)) zones.set(key, c);
      if (zones.size >= 5) break;
    }

    const out: DashboardWeatherZone[] = [];
    for (const [zoneKey, { lat, lng }] of zones) {
      try {
        const res = await this.meteo.getByCoordinates(lat, lng);
        const d = res.data as {
          temperature?: number;
          precipitation?: number;
          description?: string;
        };
        out.push({
          lat,
          lng,
          zoneKey,
          temperature: d.temperature ?? null,
          precipitation: d.precipitation ?? null,
          description: d.description ?? null,
          cached: !!res.cached,
        });
      } catch (err) {
        this.logger.warn(
          `Météo zone ${zoneKey} indisponible: ${(err as Error).message}`,
        );
        out.push({
          lat,
          lng,
          zoneKey,
          temperature: null,
          precipitation: null,
          description: null,
          cached: false,
        });
      }
    }
    return out;
  }

  private centroidLngLat(
    centroid: object | null | undefined,
  ): { lat: number; lng: number } | null {
    const c = centroid as { coordinates?: [number, number] } | null;
    if (!c?.coordinates) return null;
    const [lng, lat] = c.coordinates;
    return { lat, lng };
  }

  private hash(payload: object): string {
    const json = JSON.stringify(payload);
    return crypto.createHash("sha1").update(json).digest("hex").slice(0, 16);
  }
}
