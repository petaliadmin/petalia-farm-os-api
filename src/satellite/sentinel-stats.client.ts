import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";
import { EVALSCRIPTS } from "./evalscripts";
import { SatelliteIndexCode } from "./entities/satellite-index.entity";

const TOKEN_URL = "https://services.sentinel-hub.com/oauth/token";
const STATS_URL = "https://services.sentinel-hub.com/api/v1/statistics";

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

export interface SatelliteStat {
  date: Date;
  mean: number;
  min: number;
  max: number;
  stddev: number;
}

/**
 * Generic Sentinel-2 L2A statistics client. Reuses OAuth client_credentials
 * flow with token cache. One method = one index code.
 */
@Injectable()
export class SentinelStatsClient {
  private readonly logger = new Logger(SentinelStatsClient.name);
  private readonly http: AxiosInstance = axios.create({ timeout: 25_000 });
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(private config: ConfigService) {}

  async fetchIndex(
    indexCode: SatelliteIndexCode,
    boundary: { type: "Polygon"; coordinates: number[][][] },
    fromIso: string,
    toIso: string,
  ): Promise<SatelliteStat[]> {
    const evalscript = EVALSCRIPTS[indexCode];
    if (!evalscript) {
      throw new InternalServerErrorException(
        `Evalscript inconnu pour ${indexCode}`,
      );
    }
    const token = await this.getAccessToken();

    try {
      const { data } = await this.http.post(
        STATS_URL,
        {
          input: {
            bounds: { geometry: boundary },
            data: [
              {
                type: "sentinel-2-l2a",
                dataFilter: { maxCloudCoverage: 40 },
              },
            ],
          },
          aggregation: {
            timeRange: { from: fromIso, to: toIso },
            aggregationInterval: { of: "P5D" },
            evalscript,
            resx: 10,
            resy: 10,
          },
          calculations: { [indexCode]: { statistics: { default: {} } } },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      return this.parse(data, indexCode);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        this.logger.error(
          `Sentinel Hub ${indexCode} stats failed: ${err.response?.status} ${JSON.stringify(err.response?.data)}`,
        );
      }
      throw new ServiceUnavailableException(
        "Service satellite temporairement indisponible",
      );
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) {
      return this.cachedToken.value;
    }
    const clientId = this.config.get<string>("SENTINEL_HUB_CLIENT_ID");
    const clientSecret = this.config.get<string>("SENTINEL_HUB_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      throw new InternalServerErrorException(
        "SENTINEL_HUB_CLIENT_ID/SECRET non configurés",
      );
    }
    try {
      const params = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      });
      const { data } = await this.http.post<TokenResponse>(
        TOKEN_URL,
        params.toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      );
      this.cachedToken = {
        value: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      };
      return data.access_token;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        this.logger.error(`Sentinel Hub OAuth failed: ${err.response?.status}`);
      }
      throw new ServiceUnavailableException(
        "Authentification satellite échouée",
      );
    }
  }

  private parse(payload: any, indexCode: string): SatelliteStat[] {
    const intervals = payload?.data ?? [];
    const out: SatelliteStat[] = [];
    for (const interval of intervals) {
      const stats = interval?.outputs?.[indexCode]?.bands?.B0?.stats;
      if (!stats || stats.sampleCount === stats.noDataCount) continue;
      out.push({
        date: new Date(interval.interval.from),
        mean: Number(stats.mean.toFixed(4)),
        min: Number(stats.min.toFixed(4)),
        max: Number(stats.max.toFixed(4)),
        stddev: Number((stats.stDev ?? 0).toFixed(4)),
      });
    }
    return out;
  }
}
