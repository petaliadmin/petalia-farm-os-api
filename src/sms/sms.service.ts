import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";

interface OrangeTokenResponse {
  access_token: string;
  expires_in: number;
}

interface SmsSendResult {
  delivered: boolean;
  provider: "orange" | "noop";
  reference?: string;
  error?: string;
}

/**
 * Sends transactional SMS via Orange Developer Cloud (smsmessaging API).
 *
 * Behaviour:
 *   - When ORANGE_CLIENT_ID/SECRET/SENDER are configured, real HTTP call
 *   - Otherwise no-op success (so dev/test never breaks on missing creds)
 *   - Token cached in-process until 60 s before expiry
 *   - Numbers normalised to international format (+221... for Senegal)
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly http: AxiosInstance;
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly senderAddress?: string;
  private readonly defaultCountryCode: string;
  private cachedToken?: { value: string; expiresAt: number };

  constructor(private readonly config: ConfigService) {
    this.clientId = this.config.get<string>("ORANGE_CLIENT_ID");
    this.clientSecret = this.config.get<string>("ORANGE_CLIENT_SECRET");
    this.senderAddress = this.config.get<string>("ORANGE_SENDER_ADDRESS");
    this.defaultCountryCode = this.config.get<string>(
      "DEFAULT_COUNTRY_CODE",
      "+221",
    );
    this.http = axios.create({ timeout: 8000 });

    if (!this.isConfigured()) {
      this.logger.warn(
        "Orange SMS credentials missing — SmsService will no-op (dev mode)",
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.senderAddress);
  }

  async send(rawPhone: string, message: string): Promise<SmsSendResult> {
    const phone = this.normalize(rawPhone);
    if (!this.isConfigured() || !this.senderAddress) {
      this.logger.log(`[SMS-NOOP] to=${phone} body=${message}`);
      return { delivered: true, provider: "noop" };
    }

    try {
      const token = await this.getAccessToken();
      const sender = encodeURIComponent(this.senderAddress);
      const url = `https://api.orange.com/smsmessaging/v1/outbound/${sender}/requests`;

      const response = await this.http.post(
        url,
        {
          outboundSMSMessageRequest: {
            address: `tel:${phone}`,
            senderAddress: this.senderAddress,
            outboundSMSTextMessage: { message },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      const reference =
        response.data?.outboundSMSMessageRequest?.resourceURL ?? undefined;
      return { delivered: true, provider: "orange", reference };
    } catch (err) {
      const error = err as Error & {
        response?: { status?: number; data?: unknown };
      };
      const detail = error.response?.data ?? error.message;
      this.logger.error(
        `Orange SMS failed for ${phone}: ${JSON.stringify(detail)}`,
      );
      return {
        delivered: false,
        provider: "orange",
        error: error.message,
      };
    }
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60_000) {
      return this.cachedToken.value;
    }

    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      "base64",
    );
    const { data } = await this.http.post<OrangeTokenResponse>(
      "https://api.orange.com/oauth/v3/token",
      "grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    this.cachedToken = {
      value: data.access_token,
      expiresAt: now + data.expires_in * 1000,
    };
    return data.access_token;
  }

  private normalize(raw: string): string {
    const trimmed = raw.replace(/\s+/g, "");
    if (trimmed.startsWith("+")) return trimmed;
    if (trimmed.startsWith("00")) return `+${trimmed.slice(2)}`;
    return `${this.defaultCountryCode}${trimmed.replace(/^0/, "")}`;
  }
}
