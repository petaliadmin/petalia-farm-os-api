import { Injectable, OnModuleInit } from "@nestjs/common";
import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Histogram,
  Gauge,
} from "prom-client";

/**
 * Centralised Prometheus registry for the Petalia API.
 *
 * Exposes:
 *  - Default Node.js process metrics (event loop, GC, memory, CPU)
 *  - HTTP request counter + latency histogram (populated by MetricsMiddleware)
 *  - Bull queue depth gauges (populated by QueueMetricsCollector cron)
 *  - Business counters (NDVI fetches, PDFs, alerts, WhatsApp messages)
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  readonly httpRequestsTotal: Counter<string>;
  readonly httpRequestDuration: Histogram<string>;

  readonly queueJobsWaiting: Gauge<string>;
  readonly queueJobsActive: Gauge<string>;
  readonly queueJobsCompleted: Counter<string>;
  readonly queueJobsFailed: Counter<string>;

  readonly businessEvents: Counter<string>;
  readonly externalApiLatency: Histogram<string>;

  constructor() {
    this.registry.setDefaultLabels({
      service: "petalia-api",
      env: process.env.NODE_ENV || "development",
    });

    collectDefaultMetrics({ register: this.registry });

    this.httpRequestsTotal = new Counter({
      name: "petalia_http_requests_total",
      help: "Total HTTP requests handled by the API",
      labelNames: ["method", "route", "status"],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: "petalia_http_request_duration_seconds",
      help: "HTTP request latency in seconds",
      labelNames: ["method", "route", "status"],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.queueJobsWaiting = new Gauge({
      name: "petalia_queue_jobs_waiting",
      help: "Bull jobs in waiting state per queue",
      labelNames: ["queue"],
      registers: [this.registry],
    });

    this.queueJobsActive = new Gauge({
      name: "petalia_queue_jobs_active",
      help: "Bull jobs currently being processed per queue",
      labelNames: ["queue"],
      registers: [this.registry],
    });

    this.queueJobsCompleted = new Counter({
      name: "petalia_queue_jobs_completed_total",
      help: "Bull jobs completed successfully",
      labelNames: ["queue"],
      registers: [this.registry],
    });

    this.queueJobsFailed = new Counter({
      name: "petalia_queue_jobs_failed_total",
      help: "Bull jobs that ended in failure",
      labelNames: ["queue", "reason"],
      registers: [this.registry],
    });

    this.businessEvents = new Counter({
      name: "petalia_business_events_total",
      help: "Domain events (NDVI, diagnostics, alerts, payments, etc.)",
      labelNames: ["event", "outcome"],
      registers: [this.registry],
    });

    this.externalApiLatency = new Histogram({
      name: "petalia_external_api_duration_seconds",
      help: "Latency of upstream calls (OWM, Sentinel Hub, Claude, WhatsApp)",
      labelNames: ["provider", "outcome"],
      buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry],
    });
  }

  onModuleInit() {
    // Touch label sets so the metrics appear in /metrics from the first scrape,
    // even before any traffic arrives. Avoids confusing dashboards.
    Object.values({
      ndvi: "ndvi",
      pdf: "pdf-rapports",
      sms: "sms",
      alertes: "alertes",
      whatsapp: "whatsapp",
    }).forEach((queue) => {
      this.queueJobsWaiting.set({ queue }, 0);
      this.queueJobsActive.set({ queue }, 0);
    });
  }

  recordHttp(
    method: string,
    route: string,
    status: number,
    durationSec: number,
  ): void {
    const labels = { method, route, status: String(status) };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, durationSec);
  }

  recordBusinessEvent(event: string, outcome: "success" | "failure"): void {
    this.businessEvents.inc({ event, outcome });
  }

  recordExternalCall(
    provider: string,
    outcome: "success" | "failure",
    durationSec: number,
  ): void {
    this.externalApiLatency.observe({ provider, outcome }, durationSec);
  }

  async render(): Promise<string> {
    return this.registry.metrics();
  }
}
