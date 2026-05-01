import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";

const GRAPH_VERSION = "v20.0";

export interface SendTemplatePayload {
  toPhoneE164: string;
  templateName: string;
  language: string;
  bodyParameters: string[];
}

export interface SendTextPayload {
  toPhoneE164: string;
  text: string;
}

export interface WhatsAppApiResponse {
  waMessageId: string;
}

/**
 * Meta WhatsApp Business Cloud API client.
 *
 * Outside a 24h customer-service window, only **approved templates** can be
 * sent. We expose two send methods so the caller can choose explicitly.
 */
@Injectable()
export class WhatsAppCloudClient {
  private readonly logger = new Logger(WhatsAppCloudClient.name);
  private readonly http: AxiosInstance;
  private readonly phoneId: string | undefined;
  private readonly token: string | undefined;

  constructor(private config: ConfigService) {
    this.phoneId = this.config.get<string>("WHATSAPP_PHONE_NUMBER_ID");
    this.token = this.config.get<string>("WHATSAPP_ACCESS_TOKEN");
    this.http = axios.create({
      baseURL: `https://graph.facebook.com/${GRAPH_VERSION}`,
      timeout: 12_000,
    });
    if (!this.phoneId || !this.token) {
      this.logger.warn(
        "WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN non configurés — envois WhatsApp désactivés",
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(this.phoneId && this.token);
  }

  async sendTemplate(payload: SendTemplatePayload): Promise<WhatsAppApiResponse> {
    this.assertConfigured();
    const body = {
      messaging_product: "whatsapp",
      to: payload.toPhoneE164.replace(/^\+/, ""),
      type: "template",
      template: {
        name: payload.templateName,
        language: { code: payload.language },
        components: payload.bodyParameters.length
          ? [
              {
                type: "body",
                parameters: payload.bodyParameters.map((v) => ({
                  type: "text",
                  text: v,
                })),
              },
            ]
          : [],
      },
    };
    return this.post(body);
  }

  async sendText(payload: SendTextPayload): Promise<WhatsAppApiResponse> {
    this.assertConfigured();
    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: payload.toPhoneE164.replace(/^\+/, ""),
      type: "text",
      text: { preview_url: false, body: payload.text.slice(0, 4096) },
    };
    return this.post(body);
  }

  private async post(body: object): Promise<WhatsAppApiResponse> {
    try {
      const { data } = await this.http.post(
        `/${this.phoneId}/messages`,
        body,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
        },
      );
      const waMessageId: string | undefined = data?.messages?.[0]?.id;
      if (!waMessageId) {
        throw new Error("Réponse Meta sans messages[0].id");
      }
      return { waMessageId };
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const data = err.response?.data;
        this.logger.error(
          `WhatsApp Cloud send failed ${status} ${JSON.stringify(data)}`,
        );
        if (status === 429 || (status && status >= 500)) {
          throw new ServiceUnavailableException("WhatsApp Cloud indisponible");
        }
      }
      throw new InternalServerErrorException("Envoi WhatsApp échoué");
    }
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException("WhatsApp Cloud non configuré");
    }
  }
}
