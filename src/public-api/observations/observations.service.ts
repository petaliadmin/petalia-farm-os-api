import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Repository } from "typeorm";
import { Parcelle } from "../../parcelles/entities/parcelle.entity";
import { PublicClient } from "../common/context";
import { isUniqueViolation } from "../common/db";
import { assertPoint } from "../common/geo";
import { decodeId, decodeRef, tryDecodeId } from "../common/ids";
import { listEnvelope, paginate } from "../common/pagination";
import { presentDevice, presentObservation } from "../common/presenters";
import { FieldError, ProblemException } from "../common/problem";
import {
  fromSenml,
  OBSERVED_PROPERTIES,
  ObservedProperty,
} from "../common/vocabulary";
import { AccessPolicy } from "../consents/access-policy.service";
import {
  CreateDeviceDto,
  CreateObservationDto,
  ListDevicesQueryDto,
  ListObservationsQueryDto,
  UpdateDeviceDto,
} from "../dto/observations.dto";
import { Device } from "../entities/device.entity";
import { Observation } from "../entities/observation.entity";
import { EventsService } from "../events/events.service";

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const OBS_FARMER_SQL = `(SELECT p2."farmerId" FROM parcelles p2 WHERE p2.id = "o"."parcelleId")`;

export interface SenmlRecord {
  bn?: string;
  bt?: number;
  bu?: string;
  n?: string;
  u?: string;
  v?: number;
  t?: number;
}

@Injectable()
export class ObservationsService {
  constructor(
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    @InjectRepository(Observation)
    private readonly observations: Repository<Observation>,
    @InjectRepository(Parcelle) private readonly parcels: Repository<Parcelle>,
    private readonly policy: AccessPolicy,
    private readonly events: EventsService,
  ) {}

  // ─── Devices (organisation assets, not farmer data) ───────────────────

  async createDevice(client: PublicClient, dto: CreateDeviceDto) {
    const parcelId = dto.parcel
      ? await this.ownParcelId(client, dto.parcel, "parcel")
      : null;
    try {
      const device = await this.devices.save(
        this.devices.create({
          livemode: client.livemode,
          organisationId: client.organizationId,
          parcelleId: parcelId,
          type: dto.type,
          manufacturer: dto.manufacturer.toLowerCase(),
          model: dto.model ?? null,
          serialNumber: dto.serial_number ?? null,
          devEui: dto.dev_eui?.toUpperCase() ?? null,
          name: dto.name,
          location: dto.location ? assertPoint(dto.location) : null,
          metadata: dto.metadata ?? {},
        }),
      );
      const body = presentDevice(device);
      void this.events.emit(
        client.organizationId,
        client.livemode,
        "device.created",
        body,
      );
      return body;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ProblemException("validation_failed", {
          errors: [
            {
              field: "dev_eui",
              code: "already_registered",
              message: "DevEUI already registered",
            },
          ],
        });
      }
      throw err;
    }
  }

  async retrieveDevice(client: PublicClient, id: string) {
    return presentDevice(
      await this.loadDevice(client, decodeId("device", id), id),
    );
  }

  async updateDevice(client: PublicClient, id: string, dto: UpdateDeviceDto) {
    const device = await this.loadDevice(client, decodeId("device", id), id);
    if (dto.parcel !== undefined) {
      device.parcelleId = await this.ownParcelId(client, dto.parcel, "parcel");
    }
    Object.assign(device, {
      ...(dto.manufacturer !== undefined && {
        manufacturer: dto.manufacturer.toLowerCase(),
      }),
      ...(dto.model !== undefined && { model: dto.model }),
      ...(dto.serial_number !== undefined && {
        serialNumber: dto.serial_number,
      }),
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.location !== undefined && {
        location: assertPoint(dto.location),
      }),
      ...(dto.metadata !== undefined && {
        metadata: { ...device.metadata, ...dto.metadata },
      }),
    });
    return presentDevice(await this.devices.save(device));
  }

  async listDevices(client: PublicClient, query: ListDevicesQueryDto) {
    const qb = this.devices
      .createQueryBuilder("d")
      .where(
        '"d"."organisationId" = :org AND d.livemode = :lm AND "d"."deletedAt" IS NULL',
        {
          org: client.organizationId,
          lm: client.livemode,
        },
      );
    if (query.parcel) {
      qb.andWhere('"d"."parcelleId" = :parcelId', {
        parcelId: decodeRef("parcel", query.parcel, "parcel"),
      });
    }
    if (query.type) qb.andWhere("d.type = :type", { type: query.type });
    const page = await paginate(qb, query);
    return listEnvelope("/v1/devices", page.rows.map(presentDevice), page);
  }

  // ─── Observations ─────────────────────────────────────────────────────

  async createOne(
    client: PublicClient,
    dto: CreateObservationDto,
    requestId: string,
  ) {
    const result = await this.ingest(client, [dto], requestId, false);
    if (result.created.length) return presentObservation(result.created[0]);
    // Duplicate of an already stored device reading: return the stored one.
    const [row] = result.rows;
    const existing = await this.observations.findOne({
      where: {
        deviceId: row.deviceId!,
        property: row.property,
        observedAt: row.observedAt,
      },
    });
    return presentObservation(existing!);
  }

  async createBatch(
    client: PublicClient,
    items: CreateObservationDto[],
    requestId: string,
  ) {
    const result = await this.ingest(client, items, requestId);
    return {
      object: "observation_batch" as const,
      received: items.length,
      created: result.created.length,
      duplicates: items.length - result.created.length,
      data: result.created.map(presentObservation),
    };
  }

  /**
   * SenML (RFC 8428) pack pushed by a gateway or a LoRaWAN network server
   * for one device. Names are Petalia properties ("soil_moisture"), optionally
   * prefixed by a base name; SenML units are converted to canonical units.
   */
  async ingestSenml(
    client: PublicClient,
    deviceId: string,
    records: unknown,
    requestId: string,
  ) {
    const device = await this.loadDevice(
      client,
      decodeId("device", deviceId),
      deviceId,
    );
    if (
      !Array.isArray(records) ||
      records.length === 0 ||
      records.length > 1000
    ) {
      throw new ProblemException("validation_failed", {
        errors: [
          {
            field: "body",
            code: "invalid",
            message: "SenML pack: JSON array of 1 to 1000 records",
          },
        ],
      });
    }

    let bn = "";
    let bt = 0;
    let bu: string | undefined;
    const errors: FieldError[] = [];
    const items: CreateObservationDto[] = [];
    (records as SenmlRecord[]).forEach((r, i) => {
      if (typeof r?.bn === "string") bn = r.bn;
      if (typeof r?.bt === "number") bt = r.bt;
      if (typeof r?.bu === "string") bu = r.bu;
      if (r?.v === undefined && r?.n === undefined) return; // base-only record
      const name = `${bn}${r?.n ?? ""}`.split(/[:/]/).pop() ?? "";
      if (!(name in OBSERVED_PROPERTIES)) {
        errors.push({
          field: `[${i}].n`,
          code: "unknown_property",
          message: name,
        });
        return;
      }
      const property = name as ObservedProperty;
      if (typeof r.v !== "number" || !Number.isFinite(r.v)) {
        errors.push({
          field: `[${i}].v`,
          code: "invalid",
          message: "numeric v required",
        });
        return;
      }
      const value = fromSenml(property, r.u ?? bu, r.v);
      if (value === null) {
        errors.push({
          field: `[${i}].u`,
          code: "invalid_unit",
          message: `${r.u ?? bu} for ${property}`,
        });
        return;
      }
      // RFC 8428 §4.5.3: values ≥ 2^28 are absolute; smaller ones are relative to now.
      const t = bt + (r.t ?? 0);
      const seconds = t >= 2 ** 28 ? t : Date.now() / 1000 + t;
      items.push({
        device: deviceId,
        property,
        value,
        unit: OBSERVED_PROPERTIES[property].unit,
        observed_at: new Date(seconds * 1000).toISOString(),
        source_type: device.type === "drone" ? "drone" : "sensor",
      });
    });
    if (errors.length)
      throw new ProblemException("validation_failed", { errors });
    return this.createBatch(client, items, requestId);
  }

  async retrieve(client: PublicClient, id: string, requestId: string) {
    const obs = await this.observations.findOne({
      where: { id: decodeId("observation", id) },
    });
    const parcel = obs?.parcelleId
      ? await this.parcels.findOne({ where: { id: obs.parcelleId } })
      : null;
    const grant = obs
      ? await this.policy.rowGrant(
          client,
          obs,
          parcel?.farmerId ?? null,
          "observations:read",
        )
      : null;
    if (!obs || !grant)
      throw new ProblemException("resource_missing", { params: { id } });
    if (parcel?.farmerId) {
      this.policy.record(client, requestId, [
        {
          farmerId: parcel.farmerId,
          resourceType: "observation",
          resourceId: obs.id,
          action: "read",
          ...grant,
        },
      ]);
    }
    return presentObservation(obs);
  }

  async list(
    client: PublicClient,
    query: ListObservationsQueryDto,
    requestId: string,
  ) {
    const v = this.policy.visibility(
      "o",
      client,
      "observations:read",
      OBS_FARMER_SQL,
    );
    const qb = this.observations.createQueryBuilder("o").where(v.sql, v.params);
    if (query.parcel) {
      qb.andWhere('"o"."parcelleId" = :parcelId', {
        parcelId: decodeRef("parcel", query.parcel, "parcel"),
      });
    }
    if (query.device) {
      qb.andWhere('"o"."deviceId" = :deviceId', {
        deviceId: decodeRef("device", query.device, "device"),
      });
    }
    if (query.property)
      qb.andWhere("o.property = :property", { property: query.property });
    if (query.source_type)
      qb.andWhere('"o"."sourceType" = :source', { source: query.source_type });
    if (query.observed_after) {
      qb.andWhere('"o"."observedAt" >= :after', {
        after: new Date(query.observed_after),
      });
    }
    if (query.observed_before) {
      qb.andWhere('"o"."observedAt" < :before', {
        before: new Date(query.observed_before),
      });
    }
    const page = await paginate(qb, query, { column: "observedAt" });
    await this.logObservationReads(client, requestId, page.rows);
    return listEnvelope(
      "/v1/observations",
      page.rows.map(presentObservation),
      page,
    );
  }

  properties() {
    return {
      object: "list" as const,
      url: "/v1/observations/properties",
      has_more: false,
      next_cursor: null,
      data: Object.entries(OBSERVED_PROPERTIES).map(([property, def]) => ({
        object: "observed_property" as const,
        property,
        unit: def.unit,
        senml_units: def.senml,
        description: def.description,
      })),
    };
  }

  /**
   * Validates every item first (all-or-nothing), then inserts, skipping exact
   * resends of a device reading (same device, property and instant).
   */
  private async ingest(
    client: PublicClient,
    items: CreateObservationDto[],
    requestId: string,
    batch = true,
  ) {
    const errors: FieldError[] = [];
    const deviceIds = new Set<string>();
    const parcelIds = new Set<string>();
    const at = (i: number, field: string) =>
      batch ? `observations[${i}].${field}` : field;

    items.forEach((item, i) => {
      const def = OBSERVED_PROPERTIES[item.property as ObservedProperty];
      if (!def) {
        errors.push({
          field: at(i, "property"),
          code: "unknown_property",
          message: item.property,
        });
      } else if (item.unit !== def.unit) {
        errors.push({
          field: at(i, "unit"),
          code: "invalid_unit",
          message: `expected "${def.unit}"`,
        });
      }
      if (
        new Date(item.observed_at).getTime() >
        Date.now() + FUTURE_TOLERANCE_MS
      ) {
        errors.push({ field: at(i, "observed_at"), code: "in_future" });
      }
      if (item.device) {
        const id = tryDecodeId("device", item.device);
        if (id) deviceIds.add(id);
        else errors.push({ field: at(i, "device"), code: "invalid_reference" });
      }
      if (item.parcel) {
        const id = tryDecodeId("parcel", item.parcel);
        if (id) parcelIds.add(id);
        else errors.push({ field: at(i, "parcel"), code: "invalid_reference" });
      }
      if (!item.device && !item.parcel) {
        errors.push({
          field: at(i, "parcel"),
          code: "required",
          message: "parcel or device required",
        });
      }
    });
    if (errors.length)
      throw new ProblemException("validation_failed", { errors });

    // Only the caller's own devices and parcels accept writes.
    const devices = deviceIds.size
      ? await this.devices.find({
          where: {
            id: In([...deviceIds]),
            organisationId: client.organizationId,
            livemode: client.livemode,
            deletedAt: IsNull(),
          },
        })
      : [];
    const deviceById = new Map(devices.map((d) => [d.id, d]));
    const parcels = parcelIds.size
      ? await this.parcels.find({
          where: {
            id: In([...parcelIds]),
            organisationId: client.organizationId,
            livemode: client.livemode,
            deleted: false,
          },
        })
      : [];
    const ownParcels = new Set(parcels.map((p) => p.id));

    const rows = items.map((item, i) => {
      const deviceId = item.device ? tryDecodeId("device", item.device) : null;
      const parcelId = item.parcel ? tryDecodeId("parcel", item.parcel) : null;
      const device = deviceId ? deviceById.get(deviceId) : undefined;
      if (deviceId && !device) {
        errors.push({
          field: at(i, "device"),
          code: "resource_missing",
          message: item.device,
        });
      }
      if (parcelId && !ownParcels.has(parcelId)) {
        errors.push({
          field: at(i, "parcel"),
          code: "resource_missing",
          message: item.parcel,
        });
      }
      return this.observations.create({
        livemode: client.livemode,
        organisationId: client.organizationId,
        deviceId,
        parcelleId: parcelId ?? device?.parcelleId ?? null,
        sourceType: item.source_type ?? (deviceId ? "sensor" : "manual"),
        property: item.property,
        value: item.value,
        unit: item.unit,
        observedAt: new Date(item.observed_at),
        quality: item.quality ?? "raw",
        location: item.location
          ? assertPoint(item.location)
          : (device?.location ?? null),
        metadata: item.metadata ?? {},
      });
    });
    if (errors.length)
      throw new ProblemException("validation_failed", { errors });

    const inserted = await this.observations
      .createQueryBuilder()
      .insert()
      .into(Observation)
      .values(rows)
      .orIgnore()
      .returning("*")
      .execute();
    const created = (inserted.raw as Record<string, unknown>[]).map((raw) =>
      this.observations.create({
        ...raw,
        observedAt: new Date(raw.observedAt as string),
      } as Observation),
    );

    await this.touchDevices(rows);
    await this.logObservationReads(client, requestId, created, "write");
    this.events.emitMany(
      client.organizationId,
      client.livemode,
      "observation.created",
      created.map(presentObservation),
    );
    return { rows, created };
  }

  private async touchDevices(rows: Observation[]) {
    const latest = new Map<string, Date>();
    for (const r of rows) {
      if (!r.deviceId) continue;
      const prev = latest.get(r.deviceId);
      if (!prev || prev < r.observedAt) latest.set(r.deviceId, r.observedAt);
    }
    for (const [id, seen] of latest) {
      await this.devices
        .createQueryBuilder()
        .update(Device)
        .set({ lastSeenAt: seen })
        .where('id = :id AND ("lastSeenAt" IS NULL OR "lastSeenAt" < :seen)', {
          id,
          seen,
        })
        .execute();
    }
  }

  private async logObservationReads(
    client: PublicClient,
    requestId: string,
    rows: Observation[],
    action: "read" | "write" = "read",
  ) {
    const parcelIds = [
      ...new Set(rows.map((r) => r.parcelleId).filter(Boolean)),
    ] as string[];
    if (!parcelIds.length) return;
    const parcels = await this.parcels.find({
      where: { id: In(parcelIds) },
      select: ["id", "farmerId", "organisationId"],
    });
    this.policy.record(
      client,
      requestId,
      parcels
        .filter((p) => p.farmerId)
        .map((p) => ({
          farmerId: p.farmerId!,
          resourceType: "observation",
          action,
          basis: this.policy.basisOf(client, p.organisationId),
        })),
    );
  }

  private async loadDevice(
    client: PublicClient,
    uuid: string,
    publicId: string,
  ) {
    const device = await this.devices.findOne({
      where: {
        id: uuid,
        organisationId: client.organizationId,
        livemode: client.livemode,
        deletedAt: IsNull(),
      },
    });
    if (!device)
      throw new ProblemException("resource_missing", {
        params: { id: publicId },
      });
    return device;
  }

  private async ownParcelId(client: PublicClient, ref: string, field: string) {
    const id = decodeRef("parcel", ref, field);
    const parcel = await this.parcels.findOne({
      where: {
        id,
        organisationId: client.organizationId,
        livemode: client.livemode,
        deleted: false,
      },
      select: ["id"],
    });
    if (!parcel)
      throw new ProblemException("resource_missing", { params: { id: ref } });
    return parcel.id;
  }
}
