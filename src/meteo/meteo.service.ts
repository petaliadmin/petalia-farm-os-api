import {
  Injectable,
  Inject,
  Logger,
  ServiceUnavailableException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import axios, { AxiosInstance } from "axios";

const CACHE_TTL_CURRENT_MS = 30 * 60 * 1000;
const CACHE_TTL_FORECAST_MS = 3 * 60 * 60 * 1000;
const OWM_BASE_URL = "https://api.openweathermap.org/data/2.5";

interface OwmCurrentResponse {
  main: { temp: number; humidity: number };
  wind: { speed: number };
  weather: { icon: string; description: string }[];
  rain?: { "1h"?: number; "3h"?: number };
  name?: string;
  coord?: { lat: number; lon: number };
}

interface OwmForecastResponse {
  list: {
    dt: number;
    main: { temp_max: number; temp_min: number };
    weather: { icon: string }[];
    dt_txt: string;
  }[];
}

@Injectable()
export class MeteoService {
  private readonly logger = new Logger(MeteoService.name);
  private readonly http: AxiosInstance;
  private readonly apiKey: string | undefined;

  constructor(
    private config: ConfigService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {
    this.apiKey = this.config.get<string>("OPENWEATHER_API_KEY");
    this.http = axios.create({
      baseURL: OWM_BASE_URL,
      timeout: 8000,
      params: { units: "metric", lang: "fr" },
    });
  }

  async getByCoordinates(lat: number, lng: number) {
    this.assertApiKey();
    const key = `meteo:current:${lat.toFixed(3)}:${lng.toFixed(3)}`;
    const cached = await this.cache.get(key);
    if (cached) return { data: cached, cached: true };

    try {
      const { data } = await this.http.get<OwmCurrentResponse>("/weather", {
        params: { lat, lon: lng, appid: this.apiKey },
      });
      const result = this.normaliseCurrent(data);
      await this.cache.set(key, result, CACHE_TTL_CURRENT_MS);
      return { data: result, cached: false };
    } catch (err) {
      this.handleAxios(err, "OpenWeatherMap /weather (coords)");
    }
  }

  async getByVille(ville: string) {
    this.assertApiKey();
    const key = `meteo:current:ville:${ville.toLowerCase()}`;
    const cached = await this.cache.get(key);
    if (cached) return { data: cached, cached: true };

    try {
      const { data } = await this.http.get<OwmCurrentResponse>("/weather", {
        params: { q: `${ville},SN`, appid: this.apiKey },
      });
      const result = this.normaliseCurrent(data);
      await this.cache.set(key, result, CACHE_TTL_CURRENT_MS);
      return { data: result, cached: false };
    } catch (err) {
      this.handleAxios(err, "OpenWeatherMap /weather (ville)");
    }
  }

  async getPrevisions(ville: string) {
    this.assertApiKey();
    const key = `meteo:forecast:ville:${ville.toLowerCase()}`;
    const cached = await this.cache.get(key);
    if (cached) return { data: cached, cached: true };

    try {
      const { data } = await this.http.get<OwmForecastResponse>("/forecast", {
        params: { q: `${ville},SN`, appid: this.apiKey, cnt: 40 },
      });
      const result = this.aggregateDailyForecast(data);
      await this.cache.set(key, result, CACHE_TTL_FORECAST_MS);
      return { data: result, cached: false };
    } catch (err) {
      this.handleAxios(err, "OpenWeatherMap /forecast");
    }
  }

  private normaliseCurrent(d: OwmCurrentResponse) {
    return {
      temperature: Math.round(d.main.temp),
      humidite: d.main.humidity,
      vent: Math.round(d.wind.speed * 3.6),
      precipitation: d.rain?.["1h"] ?? d.rain?.["3h"] ?? 0,
      icon: d.weather[0]?.icon ?? "01d",
      description: d.weather[0]?.description ?? "",
      ville: d.name,
    };
  }

  private aggregateDailyForecast(d: OwmForecastResponse) {
    const days = new Map<
      string,
      { jour: string; tempMax: number; tempMin: number; icon: string }
    >();
    const dayLabels = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

    for (const slot of d.list) {
      const date = new Date(slot.dt * 1000);
      const dateKey = date.toISOString().slice(0, 10);
      const existing = days.get(dateKey);
      if (!existing) {
        days.set(dateKey, {
          jour: dayLabels[date.getDay()],
          tempMax: Math.round(slot.main.temp_max),
          tempMin: Math.round(slot.main.temp_min),
          icon: slot.weather[0]?.icon ?? "01d",
        });
      } else {
        existing.tempMax = Math.max(
          existing.tempMax,
          Math.round(slot.main.temp_max),
        );
        existing.tempMin = Math.min(
          existing.tempMin,
          Math.round(slot.main.temp_min),
        );
      }
    }
    return Array.from(days.values()).slice(0, 7);
  }

  private assertApiKey() {
    if (!this.apiKey) {
      throw new InternalServerErrorException(
        "OPENWEATHER_API_KEY non configurée",
      );
    }
  }

  private handleAxios(err: unknown, context: string): never {
    if (axios.isAxiosError(err)) {
      this.logger.error(
        `${context} failed: ${err.response?.status} ${err.message}`,
      );
      throw new ServiceUnavailableException(
        "Service météo temporairement indisponible",
      );
    }
    this.logger.error(`${context} unexpected error`, err as Error);
    throw new ServiceUnavailableException("Erreur météo inattendue");
  }
}
