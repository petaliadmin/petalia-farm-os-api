import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Parcelle } from "../parcelles/entities/parcelle.entity";
import { NdviData } from "../ndvi/entities/ndvi-data.entity";
import { MeteoService } from "../meteo/meteo.service";
import { getKc } from "./kc-coefficients";

interface CurrentWeather {
  temperature: number;
  humidite: number;
  vent: number;
  precipitation: number;
}

interface ForecastDay {
  jour: string;
  tempMax: number;
  tempMin: number;
}

@Injectable()
export class IrrigationService {
  constructor(
    @InjectRepository(Parcelle) private parcellesRepo: Repository<Parcelle>,
    @InjectRepository(NdviData) private ndviRepo: Repository<NdviData>,
    private meteo: MeteoService,
  ) {}

  /**
   * Computes daily water demand recommendation for a parcelle.
   * Method: simplified FAO-56 — ETc = ET0 × Kc(culture, stade);
   * net irrigation requirement = ETc − pluie effective.
   * NDVI < stress threshold → +20 % to compensate vegetation stress.
   */
  async recommandationParcelle(
    parcelleId: string,
    organisationId: string | null,
  ) {
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

    const centroid = parcelle.centroid as {
      coordinates?: [number, number];
    } | null;
    if (!centroid?.coordinates) {
      throw new BadRequestException(
        "Parcelle sans centroid — impossible de récupérer la météo",
      );
    }
    const [lng, lat] = centroid.coordinates;

    const [currentResp, forecastResp, lastNdvi] = await Promise.all([
      this.meteo.getByCoordinates(lat, lng),
      parcelle.localite
        ? this.meteo.getPrevisions(parcelle.localite).catch(() => null)
        : Promise.resolve(null),
      this.ndviRepo.findOne({
        where: { parcelleId },
        order: { date: "DESC" },
      }),
    ]);

    const current = currentResp?.data as CurrentWeather;
    const forecast = (forecastResp?.data as ForecastDay[] | undefined) ?? [];

    const tempAvg = forecast.length
      ? forecast
          .slice(0, 3)
          .reduce((s, d) => s + (d.tempMax + d.tempMin) / 2, 0) /
        Math.min(3, forecast.length)
      : current.temperature;

    const et0 = this.estimateET0(tempAvg, current.humidite, current.vent);
    const kc = getKc(parcelle.culture, parcelle.stade);
    const etc = Number((et0 * kc).toFixed(2));

    const pluiePrevue3j = forecast
      .slice(0, 3)
      .reduce((s) => s, current.precipitation);
    const pluieEffective = Math.min(pluiePrevue3j * 0.8, etc);

    let besoinNetMmJour = Math.max(0, etc - pluieEffective);

    let stressBoostPct = 0;
    if (lastNdvi && lastNdvi.ndviMoyen < 0.4) {
      stressBoostPct = 20;
      besoinNetMmJour = Number((besoinNetMmJour * 1.2).toFixed(2));
    }

    const volumeM3Jour = Number(
      (besoinNetMmJour * parcelle.superficie * 10).toFixed(1),
    );

    const recommandation = this.buildAdvice(
      besoinNetMmJour,
      pluiePrevue3j,
      lastNdvi?.ndviMoyen ?? null,
    );

    return {
      parcelleId,
      culture: parcelle.culture,
      stade: parcelle.stade,
      superficieHa: parcelle.superficie,
      meteo: {
        temperatureC: current.temperature,
        humiditePct: current.humidite,
        ventKmh: current.vent,
        pluiePrevue3jMm: Number(pluiePrevue3j.toFixed(1)),
      },
      ndviMoyen: lastNdvi?.ndviMoyen ?? null,
      bilanHydrique: {
        et0MmJour: et0,
        kc,
        etcMmJour: etc,
        pluieEffectiveMm: Number(pluieEffective.toFixed(1)),
        stressBoostPct,
        besoinNetMmJour: Number(besoinNetMmJour.toFixed(2)),
        volumeM3Jour,
      },
      recommandation,
    };
  }

  /**
   * Hargreaves-Samani simplified ET0 — only requires temperature, humidity,
   * wind speed (no solar radiation). Result in mm/day.
   *
   *   ET0 = 0.0023 × (T + 17.8) × √(Tmax − Tmin) × Ra
   *
   * We approximate Ra=21 MJ/m²/day for Senegal (12°-16° N latitude),
   * derate by humidity and apply a wind correction.
   */
  private estimateET0(tempC: number, humPct: number, ventKmh: number): number {
    const Ra = 21;
    const tempRange = 10;
    const base = 0.0023 * (tempC + 17.8) * Math.sqrt(tempRange) * Ra * 0.408;
    const humFactor = 1 - Math.max(0, (humPct - 40) / 100) * 0.3;
    const windFactor = 1 + Math.min(ventKmh, 30) / 100;
    return Number((base * humFactor * windFactor).toFixed(2));
  }

  private buildAdvice(
    besoinMm: number,
    pluiePrevueMm: number,
    ndvi: number | null,
  ): { niveau: string; message: string } {
    if (pluiePrevueMm > 20) {
      return {
        niveau: "differer",
        message: `Pluies prévues ${pluiePrevueMm.toFixed(0)}mm — différer l'irrigation 24-48h.`,
      };
    }
    if (besoinMm < 1) {
      return {
        niveau: "aucune",
        message: "Bilan hydrique satisfaisant — pas d'irrigation requise.",
      };
    }
    if (besoinMm < 3) {
      return {
        niveau: "legere",
        message: `Apport léger ${besoinMm.toFixed(1)}mm/jour suffisant.`,
      };
    }
    if (besoinMm < 6) {
      return {
        niveau: "modere",
        message: `Apport modéré ${besoinMm.toFixed(1)}mm/jour recommandé${ndvi !== null && ndvi < 0.4 ? " — NDVI faible, surveiller stress" : ""}.`,
      };
    }
    return {
      niveau: "important",
      message: `Apport important ${besoinMm.toFixed(1)}mm/jour requis — fractionner en 2 passages.`,
    };
  }
}
