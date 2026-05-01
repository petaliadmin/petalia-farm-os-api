import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Repository, LessThan, Not, In } from "typeorm";
import { Parcelle } from "../parcelles/entities/parcelle.entity";
import { Tache } from "../taches/entities/tache.entity";
import { NdviData } from "../ndvi/entities/ndvi-data.entity";
import { Notification } from "../notifications/entities/notification.entity";
import { MeteoService } from "../meteo/meteo.service";

const NDVI_STRESS_THRESHOLD = 0.3;
const TEMP_HEAT_THRESHOLD = 40;
const RAIN_HEAVY_THRESHOLD = 30;

@Injectable()
export class AlertesService {
  private readonly logger = new Logger(AlertesService.name);

  constructor(
    @InjectRepository(Parcelle) private parcellesRepo: Repository<Parcelle>,
    @InjectRepository(Tache) private tachesRepo: Repository<Tache>,
    @InjectRepository(NdviData) private ndviRepo: Repository<NdviData>,
    @InjectRepository(Notification)
    private notifRepo: Repository<Notification>,
    private meteo: MeteoService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async scanMeteoExtreme(): Promise<void> {
    this.logger.debug("Scanning météo extrême…");

    const parcelles = await this.parcellesRepo
      .createQueryBuilder("p")
      .where("p.deleted = false")
      .andWhere("p.technicienId IS NOT NULL")
      .andWhere("p.centroid IS NOT NULL")
      .select(["p.id", "p.code", "p.nom", "p.technicienId", "p.centroid"])
      .getMany();

    let alertsCreated = 0;
    const seenZones = new Map<string, { temp: number; rain: number }>();

    for (const p of parcelles) {
      const c = p.centroid as { coordinates?: [number, number] } | null;
      if (!c?.coordinates) continue;
      const [lng, lat] = c.coordinates;
      const zoneKey = `${lat.toFixed(2)}:${lng.toFixed(2)}`;

      try {
        let weather = seenZones.get(zoneKey);
        if (!weather) {
          const { data } = await this.meteo.getByCoordinates(lat, lng);
          weather = {
            temp: (data as { temperature: number }).temperature,
            rain: (data as { precipitation: number }).precipitation,
          };
          seenZones.set(zoneKey, weather);
        }

        if (weather.temp >= TEMP_HEAT_THRESHOLD) {
          await this.upsertAlert(
            p.technicienId,
            `meteo:heat:${p.id}`,
            "avertissement",
            "Canicule détectée",
            `Parcelle ${p.code} (${p.nom}) — température ${weather.temp}°C ≥ ${TEMP_HEAT_THRESHOLD}°C. Vérifier irrigation et stress hydrique.`,
            p.id,
            "parcelle",
          );
          alertsCreated++;
        }
        if (weather.rain >= RAIN_HEAVY_THRESHOLD) {
          await this.upsertAlert(
            p.technicienId,
            `meteo:rain:${p.id}`,
            "avertissement",
            "Fortes pluies",
            `Parcelle ${p.code} (${p.nom}) — précipitations ${weather.rain}mm. Risque inondation/lessivage.`,
            p.id,
            "parcelle",
          );
          alertsCreated++;
        }
      } catch (err) {
        this.logger.warn(
          `Météo scan failed for parcelle ${p.id}: ${(err as Error).message}`,
        );
      }
    }
    this.logger.log(`Météo scan: ${alertsCreated} alerte(s) créée(s)`);
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async scanNdviStress(): Promise<void> {
    this.logger.debug("Scanning NDVI stress…");

    const lowNdvi = await this.ndviRepo
      .createQueryBuilder("n")
      .innerJoin(Parcelle, "p", "p.id = n.parcelleId")
      .where("n.ndviMoyen < :t", { t: NDVI_STRESS_THRESHOLD })
      .andWhere("n.date >= NOW() - INTERVAL '7 days'")
      .andWhere("p.deleted = false")
      .andWhere("p.technicienId IS NOT NULL")
      .select(["n.parcelleId AS parcelleId", "n.ndviMoyen AS ndvi", "p.code AS code", "p.nom AS nom", "p.technicienId AS technicienId"])
      .getRawMany();

    let alertsCreated = 0;
    for (const r of lowNdvi) {
      await this.upsertAlert(
        r.technicienid ?? r.technicienId,
        `ndvi:stress:${r.parcelleid ?? r.parcelleId}`,
        "alerte",
        "Stress hydrique détecté",
        `Parcelle ${r.code} (${r.nom}) — NDVI ${Number(r.ndvi).toFixed(2)} sous le seuil ${NDVI_STRESS_THRESHOLD}. Inspection recommandée.`,
        r.parcelleid ?? r.parcelleId,
        "parcelle",
      );
      alertsCreated++;
    }
    this.logger.log(`NDVI scan: ${alertsCreated} alerte(s) créée(s)`);
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async scanEcheances(): Promise<void> {
    this.logger.debug("Scanning échéances…");

    const overdueTasks = await this.tachesRepo.find({
      where: {
        statut: Not(In(["done", "reporte"])),
        datePlanifiee: LessThan(new Date()),
      },
      take: 500,
    });

    let alertsCreated = 0;
    for (const t of overdueTasks) {
      await this.upsertAlert(
        t.assigneAId,
        `tache:overdue:${t.id}`,
        "alerte",
        "Tâche en retard",
        `${t.titre} — échéance ${t.datePlanifiee.toISOString().slice(0, 10)} dépassée.`,
        t.id,
        "tache",
      );
      alertsCreated++;
    }

    const overdueVisites = await this.parcellesRepo
      .createQueryBuilder("p")
      .where("p.deleted = false")
      .andWhere("p.technicienId IS NOT NULL")
      .andWhere("p.prochaineVisite IS NOT NULL")
      .andWhere("p.prochaineVisite < NOW()")
      .select(["p.id", "p.code", "p.nom", "p.technicienId", "p.prochaineVisite"])
      .limit(500)
      .getMany();

    for (const p of overdueVisites) {
      await this.upsertAlert(
        p.technicienId,
        `visite:overdue:${p.id}`,
        "avertissement",
        "Visite en retard",
        `Parcelle ${p.code} (${p.nom}) — visite prévue le ${p.prochaineVisite.toISOString().slice(0, 10)} non réalisée.`,
        p.id,
        "parcelle",
      );
      alertsCreated++;
    }
    this.logger.log(`Échéances scan: ${alertsCreated} alerte(s) créée(s)`);
  }

  private async upsertAlert(
    userId: string,
    dedupeKey: string,
    type: "alerte" | "avertissement" | "succes" | "info",
    titre: string,
    message: string,
    lienId: string | null,
    lienType: string | null,
  ): Promise<void> {
    if (!userId) return;

    const existing = await this.notifRepo
      .createQueryBuilder("n")
      .where("n.userId = :u", { u: userId })
      .andWhere("n.titre = :t", { t: titre })
      .andWhere("n.lienId = :id", { id: lienId })
      .andWhere("n.createdAt >= NOW() - INTERVAL '24 hours'")
      .getOne();

    if (existing) return;

    void dedupeKey;

    await this.notifRepo.save(
      this.notifRepo.create({
        userId,
        type,
        titre,
        message,
        lienId: lienId ?? undefined,
        lienType: lienType ?? undefined,
      }),
    );
  }
}
