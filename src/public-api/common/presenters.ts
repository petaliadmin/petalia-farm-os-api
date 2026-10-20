import { Organisation } from "../../organisations/entities/organisation.entity";
import { Parcelle } from "../../parcelles/entities/parcelle.entity";
import { ApiEvent } from "../entities/api-event.entity";
import { ApiJob } from "../entities/api-job.entity";
import { ChannelNotification } from "../entities/channel-notification.entity";
import { Consent } from "../entities/consent.entity";
import { CropCycle } from "../entities/crop-cycle.entity";
import { DataAccessLog } from "../entities/data-access-log.entity";
import { Device } from "../entities/device.entity";
import { Farm } from "../entities/farm.entity";
import { Farmer } from "../entities/farmer.entity";
import { Observation } from "../entities/observation.entity";
import { WebhookEndpoint } from "../entities/webhook-endpoint.entity";
import { encodeId } from "./ids";
import { cropFromLegacy, GROWTH_STAGES, LAND_TENURE } from "./vocabulary";

/**
 * Public representations. Rules: typed prefixed ids, an `object` field,
 * snake_case, ISO 8601 UTC timestamps, explicit units on every measure,
 * never an internal UUID.
 */
const iso = (d: Date | null | undefined) =>
  d ? new Date(d).toISOString() : null;
const day = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : null;

export function presentOrganization(o: Organisation) {
  return {
    id: encodeId("organization", o.id),
    object: "organization" as const,
    name: o.nom,
    acronym: o.sigle ?? null,
    type: o.type,
    country: o.pays,
    region: o.region ?? null,
    phone: o.telephone ?? null,
    website: o.siteWeb ?? null,
    created_at: iso(o.createdAt),
  };
}

export function presentFarmer(f: Farmer) {
  return {
    id: encodeId("farmer", f.id),
    object: "farmer" as const,
    livemode: f.livemode,
    phone: f.phone,
    first_name: f.firstName,
    last_name: f.lastName,
    gender: f.gender,
    birth_year: f.birthYear,
    preferred_language: f.preferredLanguage,
    preferred_channel: f.preferredChannel,
    locality: f.locality,
    region: f.region,
    country: f.country,
    delegate_organization: encodeId("organization", f.organisationId),
    metadata: f.metadata ?? {},
    created_at: iso(f.createdAt),
    updated_at: iso(f.updatedAt),
  };
}

export function presentFarm(f: Farm) {
  return {
    id: encodeId("farm", f.id),
    object: "farm" as const,
    livemode: f.livemode,
    farmer: encodeId("farmer", f.farmerId),
    name: f.name,
    locality: f.locality,
    region: f.region,
    location: f.location,
    metadata: f.metadata ?? {},
    created_at: iso(f.createdAt),
    updated_at: iso(f.updatedAt),
  };
}

export function presentParcel(p: Parcelle) {
  const crop = cropFromLegacy(p.culture);
  return {
    id: encodeId("parcel", p.id),
    object: "parcel" as const,
    livemode: p.livemode ?? true,
    code: p.code,
    name: p.nom,
    farmer: encodeId("farmer", p.farmerId),
    farm: encodeId("farm", p.farmId),
    organization: encodeId("organization", p.organisationId),
    geometry: p.boundary ?? null,
    centroid: p.centroid ?? null,
    area: { value: p.superficie, unit: "ha" },
    region: p.region ?? null,
    locality: p.localite ?? null,
    agroecological_zone: p.zoneAgroecologique ?? null,
    soil: { type: p.typeSol ?? p.typesSol ?? null },
    water_source: p.sourceEau ?? null,
    land_tenure: p.modeAccesTerre ? LAND_TENURE[p.modeAccesTerre] : null,
    current_crop: crop
      ? {
          crop,
          variety: p.variete ?? null,
          stage: p.stade ? (GROWTH_STAGES[p.stade] ?? p.stade) : null,
          sown_on: day(p.dateSemis),
        }
      : null,
    health: { status: p.statut, score: p.healthScore },
    metadata: p.metadata ?? {},
    created_at: iso(p.createdAt),
    updated_at: iso(p.updatedAt),
  };
}

/** GeoJSON Feature form (Accept: application/geo+json or ?format=geojson). */
export function parcelFeature(p: Parcelle) {
  const { geometry, ...properties } = presentParcel(p);
  return { type: "Feature" as const, id: properties.id, geometry, properties };
}

export function presentCropCycle(c: CropCycle) {
  return {
    id: encodeId("crop_cycle", c.id),
    object: "crop_cycle" as const,
    livemode: c.livemode,
    parcel: encodeId("parcel", c.parcelleId),
    crop: c.crop,
    variety: c.variety,
    season: c.season,
    campaign_year: c.campaignYear,
    status: c.status,
    sown_on: c.sownOn,
    expected_harvest_on: c.expectedHarvestOn,
    harvested_on: c.harvestedOn,
    yield: c.yieldKg === null ? null : { value: c.yieldKg, unit: "kg" },
    metadata: c.metadata ?? {},
    created_at: iso(c.createdAt),
    updated_at: iso(c.updatedAt),
  };
}

export function presentDevice(d: Device) {
  return {
    id: encodeId("device", d.id),
    object: "device" as const,
    livemode: d.livemode,
    type: d.type,
    manufacturer: d.manufacturer,
    model: d.model,
    serial_number: d.serialNumber,
    dev_eui: d.devEui,
    name: d.name,
    status: d.status,
    parcel: encodeId("parcel", d.parcelleId),
    location: d.location,
    last_seen_at: iso(d.lastSeenAt),
    metadata: d.metadata ?? {},
    created_at: iso(d.createdAt),
    updated_at: iso(d.updatedAt),
  };
}

export function presentObservation(o: Observation) {
  return {
    id: encodeId("observation", o.id),
    object: "observation" as const,
    livemode: o.livemode,
    parcel: encodeId("parcel", o.parcelleId),
    source: {
      type: o.sourceType,
      device: encodeId("device", o.deviceId),
    },
    property: o.property,
    value: o.value,
    unit: o.unit,
    observed_at: iso(o.observedAt),
    quality: o.quality,
    location: o.location,
    metadata: o.metadata ?? {},
    created_at: iso(o.createdAt),
  };
}

export function presentConsent(c: Consent) {
  return {
    id: encodeId("consent", c.id),
    object: "consent" as const,
    livemode: c.livemode,
    farmer: encodeId("farmer", c.farmerId),
    grantee: encodeId("organization", c.granteeOrganisationId),
    scopes: c.scopes,
    purpose: c.purpose,
    status: c.status,
    method: c.method,
    confirmation_expires_at:
      c.status === "pending" ? iso(c.otpExpiresAt) : null,
    granted_at: iso(c.grantedAt),
    revoked_at: iso(c.revokedAt),
    expires_at: iso(c.expiresAt),
    created_at: iso(c.createdAt),
  };
}

export function presentAccessLog(l: DataAccessLog) {
  return {
    id: encodeId("access_log", l.id),
    object: "access_log" as const,
    farmer: encodeId("farmer", l.farmerId),
    organization: encodeId("organization", l.organisationId),
    api_key: encodeId("api_key", l.apiKeyId),
    action: l.action,
    resource_type: l.resourceType,
    basis: l.basis,
    consent: encodeId("consent", l.consentId),
    request_id: l.requestId,
    created_at: iso(l.createdAt),
  };
}

export function presentEvent(e: ApiEvent) {
  return {
    id: encodeId("event", e.id),
    object: "event" as const,
    livemode: e.livemode,
    type: e.type,
    api_version: e.apiVersion,
    data: { object: e.data },
    created_at: iso(e.createdAt),
  };
}

export function presentWebhookEndpoint(w: WebhookEndpoint, secret?: string) {
  return {
    id: encodeId("webhook_endpoint", w.id),
    object: "webhook_endpoint" as const,
    livemode: w.livemode,
    url: w.url,
    description: w.description,
    enabled_events: w.enabledEvents,
    status: w.status,
    api_version: w.apiVersion,
    // Only returned once, at creation.
    ...(secret ? { secret } : {}),
    metadata: w.metadata ?? {},
    created_at: iso(w.createdAt),
  };
}

export function presentNotification(n: ChannelNotification) {
  return {
    id: encodeId("notification", n.id),
    object: "notification" as const,
    livemode: n.livemode,
    farmer: encodeId("farmer", n.farmerId),
    to: n.toPhone,
    channel: n.channel,
    language: n.language,
    body: n.body,
    status: n.status,
    failure_reason: n.failureReason,
    sent_at: iso(n.sentAt),
    metadata: n.metadata ?? {},
    created_at: iso(n.createdAt),
  };
}

export function presentJob(j: ApiJob) {
  return {
    id: encodeId("job", j.id),
    object: "job" as const,
    livemode: j.livemode,
    type: j.type,
    status: j.status,
    parcel: encodeId("parcel", j.parcelleId),
    result: j.result,
    error: j.error,
    created_at: iso(j.createdAt),
    completed_at: iso(j.completedAt),
  };
}
