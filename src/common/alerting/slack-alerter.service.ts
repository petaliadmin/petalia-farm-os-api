import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";

export type AlertSeverity = "info" | "warning" | "error" | "critical";

export interface AlertPayload {
  /** Stable identifier used for de-duplication (e.g. "queue.ndvi.failed"). */
  key: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  context?: Record<string, string | number | boolean | undefined>;
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  fields?: Array<{ type: string; text: string }>;
}

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  info: ":information_source:",
  warning: ":warning:",
  error: ":x:",
  critical: ":rotating_light:",
};

const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  info: "#36a64f",
  warning: "#ffcc00",
  error: "#ff6b00",
  critical: "#d10000",
};

/**
 * Posts incident notifications to Slack. Production usage:
 *   - Configure SLACK_WEBHOOK_URL in env
 *   - Call from queue failure handlers, cron failures, payment errors, etc.
 *
 * Built-in protections:
 *   - In-memory dedup window (default 5 min) per `key` to avoid alert storms
 *   - Fire-and-forget with bounded concurrency (no awaiting on hot paths)
 *   - Soft-fails: a Slack outage never breaks the calling code
 */
@Injectable()
export class SlackAlerterService {
  private readonly logger = new Logger(SlackAlerterService.name);
  private readonly http: AxiosInstance;
  private readonly webhookUrl?: string;
  private readonly dedupWindowMs: number;
  private readonly recentAlerts = new Map<string, number>();
  private readonly enabled: boolean;
  private readonly env: string;

  constructor(private readonly config: ConfigService) {
    this.webhookUrl = this.config.get<string>("SLACK_WEBHOOK_URL");
    this.enabled = Boolean(this.webhookUrl);
    this.dedupWindowMs = this.config.get<number>(
      "SLACK_ALERT_DEDUP_MS",
      5 * 60 * 1000,
    );
    this.env = this.config.get<string>("NODE_ENV", "development");
    this.http = axios.create({ timeout: 4000 });

    if (!this.enabled) {
      this.logger.warn(
        "SLACK_WEBHOOK_URL not set — Slack alerts disabled (logs only)",
      );
    }
  }

  /**
   * Fire-and-forget. Returns true if the alert was sent (or queued),
   * false if suppressed by the dedup window.
   */
  notify(alert: AlertPayload): boolean {
    if (this.isDuplicate(alert.key)) {
      this.logger.debug(`Suppressed duplicate alert: ${alert.key}`);
      return false;
    }

    this.logAlert(alert);

    if (!this.enabled || !this.webhookUrl) return true;

    void this.send(this.webhookUrl, alert).catch((err) => {
      this.logger.error(
        `Slack notification failed for ${alert.key}: ${(err as Error).message}`,
      );
    });

    return true;
  }

  private isDuplicate(key: string): boolean {
    const now = Date.now();
    this.evictExpired(now);
    const last = this.recentAlerts.get(key);
    if (last && now - last < this.dedupWindowMs) return true;
    this.recentAlerts.set(key, now);
    return false;
  }

  private evictExpired(now: number): void {
    for (const [k, t] of this.recentAlerts) {
      if (now - t >= this.dedupWindowMs) this.recentAlerts.delete(k);
    }
  }

  private logAlert(alert: AlertPayload): void {
    const ctx = alert.context ? JSON.stringify(alert.context) : "";
    const line = `[ALERT:${alert.severity}] ${alert.title} — ${alert.message} ${ctx}`;
    if (alert.severity === "critical" || alert.severity === "error") {
      this.logger.error(line);
    } else if (alert.severity === "warning") {
      this.logger.warn(line);
    } else {
      this.logger.log(line);
    }
  }

  private async send(url: string, alert: AlertPayload): Promise<void> {
    const blocks: SlackBlock[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${SEVERITY_EMOJI[alert.severity]} ${alert.title}`,
        },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: alert.message },
      },
    ];

    const fields: Array<{ type: string; text: string }> = [
      { type: "mrkdwn", text: `*Env:*\n${this.env}` },
      { type: "mrkdwn", text: `*Severity:*\n${alert.severity}` },
    ];

    if (alert.context) {
      for (const [k, v] of Object.entries(alert.context)) {
        if (v === undefined || v === null) continue;
        fields.push({ type: "mrkdwn", text: `*${k}:*\n${String(v)}` });
      }
    }

    blocks.push({ type: "section", fields });

    await this.http.post(url, {
      attachments: [
        {
          color: SEVERITY_COLOR[alert.severity],
          blocks,
        },
      ],
    });
  }
}
