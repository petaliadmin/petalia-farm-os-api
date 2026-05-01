import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { MarketPrice } from "./entities/market-price.entity";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MIN_HISTORY_POINTS = 8;
const MAX_HORIZON_DAYS = 90;

interface ForecastPoint {
  date: string;
  prevPrixFcfaPerKg: number;
  ic80Bas: number;
  ic80Haut: number;
}

export interface ForecastResult {
  culture: string;
  marche: string;
  generatedAt: string;
  horizonDays: number;
  historyPoints: number;
  trendPctMonthly: number;
  rmse: number;
  forecast: ForecastPoint[];
}

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);

  constructor(
    @InjectRepository(MarketPrice)
    private priceRepo: Repository<MarketPrice>,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async ingest(
    rows: Array<Partial<MarketPrice>>,
  ): Promise<{ inserted: number }> {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException("rows[] requis");
    }
    const valid = rows.filter(
      (r) => r.culture && r.marche && r.date && typeof r.prixFcfaPerKg === "number",
    );
    if (valid.length === 0) {
      throw new BadRequestException(
        "Chaque ligne doit contenir culture, marche, date, prixFcfaPerKg",
      );
    }
    const result = await this.priceRepo
      .createQueryBuilder()
      .insert()
      .values(valid)
      .orIgnore()
      .execute();
    return { inserted: result.identifiers?.length ?? valid.length };
  }

  async timeseries(
    culture: string,
    marche: string,
    days: number,
  ): Promise<{ date: string; prixFcfaPerKg: number }[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const rows = await this.priceRepo
      .createQueryBuilder("p")
      .where("p.culture = :c AND p.marche = :m", { c: culture, m: marche })
      .andWhere("p.date >= :since", { since })
      .orderBy("p.date", "ASC")
      .getMany();
    return rows.map((r) => ({
      date: this.toIsoDate(r.date),
      prixFcfaPerKg: r.prixFcfaPerKg,
    }));
  }

  async forecast(
    culture: string,
    marche: string,
    horizonDays: number,
  ): Promise<ForecastResult> {
    if (horizonDays < 1 || horizonDays > MAX_HORIZON_DAYS) {
      throw new BadRequestException(
        `horizonDays doit être ∈ [1, ${MAX_HORIZON_DAYS}]`,
      );
    }
    const cacheKey = `market:forecast:${culture}:${marche}:${horizonDays}`;
    const cached = await this.cache.get<ForecastResult>(cacheKey);
    if (cached) return cached;

    // 3 ans d'historique pour capturer la saisonnalité
    const since = new Date();
    since.setDate(since.getDate() - 3 * 365);
    const history = await this.priceRepo
      .createQueryBuilder("p")
      .where("p.culture = :c AND p.marche = :m", { c: culture, m: marche })
      .andWhere("p.date >= :since", { since })
      .orderBy("p.date", "ASC")
      .getMany();

    if (history.length < MIN_HISTORY_POINTS) {
      throw new BadRequestException(
        `Historique insuffisant (${history.length} < ${MIN_HISTORY_POINTS})`,
      );
    }

    const result = this.computeForecast(
      culture,
      marche,
      history,
      horizonDays,
    );
    await this.cache.set(cacheKey, result, CACHE_TTL_MS);
    return result;
  }

  /**
   * Modèle simple, transparent et déployable sans dépendance ML :
   *
   *  log(price_t)  ≈  α + β·t + S(month_t) + ε
   *
   * - β estimé par moindres carrés ordinaires sur log-prix vs jours-depuis-t0.
   * - S(month) = médiane sur 3 ans des résidus log par mois calendaire.
   * - prédiction = exp(α + β·t_future + S(month_future)).
   * - σ = std des résidus log → IC80 ≈ ±1.28σ retransformé.
   *
   * Évolutif : remplaçable par Prophet/ARIMA plus tard sans changer l'API.
   */
  private computeForecast(
    culture: string,
    marche: string,
    history: MarketPrice[],
    horizonDays: number,
  ): ForecastResult {
    const t0 = history[0].date.getTime();
    const xs = history.map(
      (p) => (p.date.getTime() - t0) / 86_400_000,
    );
    const ys = history.map((p) => Math.log(Math.max(p.prixFcfaPerKg, 1)));
    const n = xs.length;
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - meanX) * (ys[i] - meanY);
      den += (xs[i] - meanX) ** 2;
    }
    const beta = den > 0 ? num / den : 0;
    const alpha = meanY - beta * meanX;

    // Résidus log
    const residuals: number[] = [];
    const monthlyResiduals: Map<number, number[]> = new Map();
    for (let i = 0; i < n; i++) {
      const yhat = alpha + beta * xs[i];
      const r = ys[i] - yhat;
      residuals.push(r);
      const m = history[i].date.getUTCMonth();
      if (!monthlyResiduals.has(m)) monthlyResiduals.set(m, []);
      monthlyResiduals.get(m)!.push(r);
    }
    const seasonal = new Map<number, number>();
    for (let m = 0; m < 12; m++) {
      const arr = monthlyResiduals.get(m) ?? [];
      seasonal.set(m, arr.length ? this.median(arr) : 0);
    }

    // RMSE retransformé en FCFA
    const rmseLog = Math.sqrt(
      residuals.reduce((a, b) => a + b * b, 0) / n,
    );
    const rmseFcfa = Number(
      (
        Math.exp(meanY) * (Math.exp(rmseLog) - 1)
      ).toFixed(0),
    );

    // Forecast horizonDays jours à partir de today
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const forecast: ForecastPoint[] = [];
    for (let d = 1; d <= horizonDays; d++) {
      const future = new Date(today.getTime() + d * 86_400_000);
      const x = (future.getTime() - t0) / 86_400_000;
      const m = future.getUTCMonth();
      const yhat = alpha + beta * x + (seasonal.get(m) ?? 0);
      const mean = Math.exp(yhat);
      const ic80 = 1.2816 * rmseLog;
      forecast.push({
        date: this.toIsoDate(future),
        prevPrixFcfaPerKg: Number(mean.toFixed(0)),
        ic80Bas: Number((Math.exp(yhat - ic80)).toFixed(0)),
        ic80Haut: Number((Math.exp(yhat + ic80)).toFixed(0)),
      });
    }

    // Tendance mensuelle = exp(β·30) − 1
    const trendPctMonthly = Number(
      ((Math.exp(beta * 30) - 1) * 100).toFixed(2),
    );

    return {
      culture,
      marche,
      generatedAt: new Date().toISOString(),
      horizonDays,
      historyPoints: n,
      trendPctMonthly,
      rmse: rmseFcfa,
      forecast,
    };
  }

  private median(arr: number[]): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private toIsoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}
