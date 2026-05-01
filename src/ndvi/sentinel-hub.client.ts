import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";

const TOKEN_URL =
  "https://services.sentinel-hub.com/oauth/token";
const STATS_URL =
  "https://services.sentinel-hub.com/api/v1/statistics";

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

export interface NdviStats {
  date: Date;
  ndviMean: number;
  ndviMin: number;
  ndviMax: number;
  cloudCoverage: number;
}

const NDVI_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  const ndvi = (s.B08 - s.B04) / (s.B08 + s.B04 + 1e-9);
  const valid = s.dataMask === 1 && s.SCL !== 3 && s.SCL !== 8 && s.SCL !== 9 && s.SCL !== 10;
  return { ndvi: [ndvi], dataMask: [valid ? 1 : 0] };
}`;

@Injectable()
export class SentinelHubClient {
  private readonly logger = new Logger(SentinelHubClient.name);
  private readonly http: AxiosInstance = axios.create({ timeout: 20_000 });
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(private config: ConfigService) {}

  async getNdviStats(
    boundary: { type: "Polygon"; coordinates: number[][][] },
    fromIso: string,
    toIso: string,
  ): Promise<NdviStats[]> {
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
            evalscript: NDVI_EVALSCRIPT,
            resx: 10,
            resy: 10,
          },
          calculations: { ndvi: { statistics: { default: {} } } },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      return this.parseStats(data);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        this.logger.error(
          `Sentinel Hub stats failed: ${err.response?.status} ${JSON.stringify(err.response?.data)}`,
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
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        },
      );
      this.cachedToken = {
        value: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      };
      return data.access_token;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        this.logger.error(
          `Sentinel Hub OAuth failed: ${err.response?.status}`,
        );
      }
      throw new ServiceUnavailableException(
        "Authentification satellite échouée",
      );
    }
  }

  private parseStats(payload: any): NdviStats[] {
    const intervals = payload?.data ?? [];
    const out: NdviStats[] = [];
    for (const interval of intervals) {
      const stats = interval?.outputs?.ndvi?.bands?.B0?.stats;
      if (!stats || stats.sampleCount === stats.noDataCount) continue;
      out.push({
        date: new Date(interval.interval.from),
        ndviMean: Number(stats.mean.toFixed(3)),
        ndviMin: Number(stats.min.toFixed(3)),
        ndviMax: Number(stats.max.toFixed(3)),
        cloudCoverage: 0,
      });
    }
    return out;
  }
}
