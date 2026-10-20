/**
 * Contract constants for the public Petalia API (/api/v1).
 *
 * Breaking changes ship only behind a new dated version. Add the new date to
 * SUPPORTED_API_VERSIONS, keep the old one for at least 12 months
 * (deprecation policy) and branch on `req.publicApi.version` where needed.
 */
export const CURRENT_API_VERSION = "2026-10-01";
export const SUPPORTED_API_VERSIONS: readonly string[] = [CURRENT_API_VERSION];

export const PUBLIC_API_DOCS_BASE = "https://docs.petalia.sn";

export const SUPPORTED_LOCALES = ["fr", "en", "wo"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";

/** Scopes understood by /v1. Legacy /partner scopes live in ApiKeyScope too. */
export const PUBLIC_SCOPES = [
  "organizations:read",
  "farmers:read",
  "farmers:write",
  "parcels:read",
  "parcels:write",
  "observations:read",
  "observations:write",
  "devices:read",
  "devices:write",
  "consents:read",
  "consents:write",
  "notifications:write",
  "webhooks:write",
  "events:read",
  "finance:read",
] as const;
export type PublicScope = (typeof PUBLIC_SCOPES)[number];

/**
 * Scopes a farmer can grant to a third party. Everything else is only
 * available to the farmer's delegate organisation (their cooperative).
 */
export const CONSENTABLE_SCOPES: readonly PublicScope[] = [
  "farmers:read",
  "parcels:read",
  "observations:read",
  "notifications:write",
  "finance:read",
];

export const CHANNELS = ["sms", "whatsapp", "ussd", "voice"] as const;
export type Channel = (typeof CHANNELS)[number];

/** Currency handled by the platform. XOF has no minor unit: amounts are integers. */
export const DEFAULT_CURRENCY = "XOF";

export const EVENT_TYPES = [
  "farmer.created",
  "farmer.updated",
  "parcel.created",
  "parcel.updated",
  "crop_cycle.created",
  "crop_cycle.updated",
  "device.created",
  "observation.created",
  "consent.granted",
  "consent.revoked",
  "notification.sent",
  "notification.failed",
  "job.succeeded",
  "job.failed",
  // Reserved for upcoming layers (intelligence, transactions).
  "alert.pest_risk",
  "payment.succeeded",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const PUBLIC_QUEUES = {
  WEBHOOKS: "public-webhooks",
} as const;
