import { Injectable } from "@nestjs/common";
import { SmsService } from "../../sms/sms.service";
import { WhatsAppCloudClient } from "../../whatsapp/whatsapp-cloud.client";
import { Channel } from "../public-api.constants";

export interface ChannelSendResult {
  delivered: boolean;
  reference?: string;
  error?: string;
}

export interface ChannelProvider {
  readonly channel: Channel;
  isAvailable(): boolean;
  send(
    toE164: string,
    body: string,
    language: string,
  ): Promise<ChannelSendResult>;
}

@Injectable()
export class SmsChannel implements ChannelProvider {
  readonly channel = "sms" as const;
  constructor(private readonly sms: SmsService) {}

  isAvailable() {
    return true; // no-ops in dev when Orange credentials are missing
  }

  async send(to: string, body: string): Promise<ChannelSendResult> {
    const r = await this.sms.send(to, body);
    return { delivered: r.delivered, reference: r.reference, error: r.error };
  }
}

/**
 * Free-form WhatsApp text. Meta only delivers it inside the 24 h window
 * after the farmer's last message; outside it the send fails and the
 * notification is marked failed with Meta's reason.
 */
@Injectable()
export class WhatsAppChannel implements ChannelProvider {
  readonly channel = "whatsapp" as const;
  constructor(private readonly cloud: WhatsAppCloudClient) {}

  isAvailable() {
    return this.cloud.isConfigured();
  }

  async send(to: string, body: string): Promise<ChannelSendResult> {
    try {
      const r = await this.cloud.sendText({ toPhoneE164: to, text: body });
      return { delivered: true, reference: r.waMessageId };
    } catch (err) {
      return { delivered: false, error: (err as Error).message };
    }
  }
}

/**
 * USSD push and voice (IVR, Wolof/Pulaar text-to-speech) are part of the
 * contract but have no operator integration yet: the API answers
 * 422 channel_unavailable until a provider is plugged in here.
 */
@Injectable()
export class ChannelRegistry {
  private readonly providers: Partial<Record<Channel, ChannelProvider>>;

  constructor(sms: SmsChannel, whatsapp: WhatsAppChannel) {
    this.providers = { sms, whatsapp };
  }

  get(channel: Channel): ChannelProvider | null {
    const provider = this.providers[channel];
    return provider?.isAvailable() ? provider : null;
  }
}
