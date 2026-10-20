import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomBytes } from "crypto";
import { IsNull, Repository } from "typeorm";
import { Parcelle } from "../../parcelles/entities/parcelle.entity";
import { PublicClient } from "../common/context";
import { isUniqueViolation } from "../common/db";
import {
  assertPolygon,
  parseBbox,
  parseIntersects,
  parseNear,
  polygonAreaHa,
} from "../common/geo";
import { decodeId, decodeRef } from "../common/ids";
import { listEnvelope, paginate } from "../common/pagination";
import {
  parcelFeature,
  presentCropCycle,
  presentParcel,
} from "../common/presenters";
import { ProblemException } from "../common/problem";
import { cropToLegacy, SEASONS } from "../common/vocabulary";
import { AccessPolicy, Grant } from "../consents/access-policy.service";
import {
  CreateCropCycleDto,
  CreateParcelDto,
  ListCropCyclesQueryDto,
  ListParcelsQueryDto,
  UpdateCropCycleDto,
  UpdateParcelDto,
} from "../dto/parcels.dto";
import { CropCycle } from "../entities/crop-cycle.entity";
import { Farm } from "../entities/farm.entity";
import { Farmer } from "../entities/farmer.entity";
import { EventsService } from "../events/events.service";
import { PublicScope } from "../public-api.constants";

const TENURE_TO_LEGACY: Record<string, string> = {
  owned: "propriete",
  borrowed: "pret",
  rented: "location",
  communal: "communautaire",
};

const PARCEL_FARMER_SQL = (alias: string) =>
  `(SELECT p2."farmerId" FROM parcelles p2 WHERE p2.id = "${alias}"."parcelleId")`;

@Injectable()
export class ParcelsService {
  constructor(
    @InjectRepository(Parcelle) private readonly parcels: Repository<Parcelle>,
    @InjectRepository(CropCycle) private readonly cycles: Repository<CropCycle>,
    @InjectRepository(Farm) private readonly farms: Repository<Farm>,
    private readonly policy: AccessPolicy,
    private readonly events: EventsService,
  ) {}

  async create(client: PublicClient, dto: CreateParcelDto, requestId: string) {
    const geometry = assertPolygon(dto.geometry);
    const area = polygonAreaHa(geometry);
    if (area <= 0) {
      throw new ProblemException("invalid_geometry", {
        params: { reason: "polygon area must be greater than zero" },
      });
    }
    const { farmer, farm } = await this.resolveOwnership(
      client,
      dto.farmer,
      dto.farm,
    );

    const parcel = this.parcels.create({
      code: dto.code ?? `PRC-${randomBytes(4).toString("hex").toUpperCase()}`,
      nom: dto.name,
      producteurNom: farmer
        ? `${farmer.firstName} ${farmer.lastName}`
        : dto.name,
      boundary: geometry,
      superficie: area,
      region: dto.region ?? farmer?.region ?? undefined,
      localite: dto.locality ?? farmer?.locality ?? undefined,
      zoneAgroecologique: dto.agroecological_zone,
      typeSol: dto.soil_type,
      sourceEau: dto.water_source,
      modeAccesTerre: dto.land_tenure
        ? TENURE_TO_LEGACY[dto.land_tenure]
        : undefined,
      culture: dto.crop ? cropToLegacy(dto.crop) : undefined,
      variete: dto.variety,
      dateSemis: dto.sown_on ? new Date(dto.sown_on) : undefined,
      organisationId: client.organizationId,
      farmerId: farmer?.id ?? null,
      farmId: farm?.id ?? null,
      livemode: client.livemode,
      metadata: dto.metadata ?? {},
    });

    const saved = await this.saveParcel(parcel);
    const body = presentParcel(saved);
    if (saved.farmerId) {
      this.policy.record(client, requestId, [
        {
          farmerId: saved.farmerId,
          resourceType: "parcel",
          resourceId: saved.id,
          action: "write",
          basis: "delegate",
        },
      ]);
    }
    void this.events.emit(
      client.organizationId,
      client.livemode,
      "parcel.created",
      body,
    );
    return body;
  }

  async retrieve(client: PublicClient, id: string, requestId: string) {
    const { parcel, grant } = await this.loadParcel(client, id, "parcels:read");
    this.logParcels(client, requestId, [parcel], "read", grant);
    return presentParcel(parcel);
  }

  async update(
    client: PublicClient,
    id: string,
    dto: UpdateParcelDto,
    requestId: string,
  ) {
    const { parcel, grant } = await this.loadParcel(
      client,
      id,
      "parcels:write",
    );
    if (dto.geometry !== undefined) {
      const geometry = assertPolygon(dto.geometry);
      parcel.boundary = geometry;
      parcel.superficie = polygonAreaHa(geometry);
    }
    if (dto.farmer !== undefined || dto.farm !== undefined) {
      const { farmer, farm } = await this.resolveOwnership(
        client,
        dto.farmer,
        dto.farm,
      );
      parcel.farmerId = farmer?.id ?? null;
      parcel.farmId = farm?.id ?? null;
      if (farmer)
        parcel.producteurNom = `${farmer.firstName} ${farmer.lastName}`;
    }
    Object.assign(parcel, {
      ...(dto.name !== undefined && { nom: dto.name }),
      ...(dto.code !== undefined && { code: dto.code }),
      ...(dto.region !== undefined && { region: dto.region }),
      ...(dto.locality !== undefined && { localite: dto.locality }),
      ...(dto.agroecological_zone !== undefined && {
        zoneAgroecologique: dto.agroecological_zone,
      }),
      ...(dto.soil_type !== undefined && { typeSol: dto.soil_type }),
      ...(dto.water_source !== undefined && { sourceEau: dto.water_source }),
      ...(dto.land_tenure !== undefined && {
        modeAccesTerre: TENURE_TO_LEGACY[dto.land_tenure],
      }),
      ...(dto.crop !== undefined && { culture: cropToLegacy(dto.crop) }),
      ...(dto.variety !== undefined && { variete: dto.variety }),
      ...(dto.sown_on !== undefined && { dateSemis: new Date(dto.sown_on) }),
      ...(dto.metadata !== undefined && {
        metadata: { ...parcel.metadata, ...dto.metadata },
      }),
    });
    const saved = await this.saveParcel(parcel);
    const body = presentParcel(saved);
    this.logParcels(client, requestId, [saved], "write", grant);
    void this.events.emit(
      client.organizationId,
      client.livemode,
      "parcel.updated",
      body,
    );
    return body;
  }

  async list(
    client: PublicClient,
    query: ListParcelsQueryDto,
    requestId: string,
  ) {
    const v = this.policy.visibility(
      "p",
      client,
      "parcels:read",
      '"p"."farmerId"',
    );
    const qb = this.parcels
      .createQueryBuilder("p")
      .where(v.sql, v.params)
      .andWhere("p.deleted = false");

    if (query.farmer) {
      qb.andWhere('"p"."farmerId" = :farmerId', {
        farmerId: decodeRef("farmer", query.farmer, "farmer"),
      });
    }
    if (query.farm) {
      qb.andWhere('"p"."farmId" = :farmId', {
        farmId: decodeRef("farm", query.farm, "farm"),
      });
    }
    if (query.crop) {
      qb.andWhere("p.culture = :culture", {
        culture: cropToLegacy(query.crop),
      });
    }
    if (query.bbox) {
      const b = parseBbox(query.bbox);
      qb.andWhere(
        "ST_Intersects(ST_GeomFromGeoJSON(p.centroid::text), ST_MakeEnvelope(:minLng, :minLat, :maxLng, :maxLat, 4326))",
        b,
      );
    }
    if (query.near) {
      const n = parseNear(query.near, query.radius);
      qb.andWhere(
        "ST_DWithin(ST_GeomFromGeoJSON(p.centroid::text)::geography, ST_SetSRID(ST_MakePoint(:nearLng, :nearLat), 4326)::geography, :radiusM)",
        { nearLng: n.lng, nearLat: n.lat, radiusM: n.radiusM },
      );
    }
    if (query.intersects) {
      const g = parseIntersects(query.intersects);
      qb.andWhere("p.boundary IS NOT NULL").andWhere(
        "ST_Intersects(ST_GeomFromGeoJSON(p.boundary::text), ST_GeomFromGeoJSON(:geom))",
        { geom: JSON.stringify(g) },
      );
    }

    const page = await paginate(qb, query);
    this.logParcels(client, requestId, page.rows, "read");

    if (query.format === "geojson") {
      return {
        type: "FeatureCollection" as const,
        features: page.rows.map(parcelFeature),
        has_more: page.hasMore,
        next_cursor: page.nextCursor,
      };
    }
    return listEnvelope("/v1/parcels", page.rows.map(presentParcel), page);
  }

  async createCycle(
    client: PublicClient,
    dto: CreateCropCycleDto,
    requestId: string,
  ) {
    const { parcel, grant } = await this.loadParcel(
      client,
      dto.parcel,
      "parcels:write",
      "parcel",
    );
    const cycle = await this.cycles.save(
      this.cycles.create({
        livemode: client.livemode,
        organisationId: client.organizationId,
        parcelleId: parcel.id,
        crop: dto.crop,
        variety: dto.variety ?? null,
        season: dto.season,
        campaignYear: dto.campaign_year,
        status: dto.status ?? "planned",
        sownOn: dto.sown_on ?? null,
        expectedHarvestOn: dto.expected_harvest_on ?? null,
        harvestedOn: dto.harvested_on ?? null,
        yieldKg: dto.yield?.value ?? null,
        metadata: dto.metadata ?? {},
      }),
    );
    await this.syncParcelCrop(parcel, cycle);
    this.logParcels(client, requestId, [parcel], "write", grant, "crop_cycle");
    const body = presentCropCycle(cycle);
    void this.events.emit(
      client.organizationId,
      client.livemode,
      "crop_cycle.created",
      body,
    );
    return body;
  }

  async retrieveCycle(client: PublicClient, id: string, requestId: string) {
    const { cycle, parcel, grant } = await this.loadCycle(
      client,
      id,
      "parcels:read",
    );
    this.logParcels(client, requestId, [parcel], "read", grant, "crop_cycle");
    return presentCropCycle(cycle);
  }

  async updateCycle(
    client: PublicClient,
    id: string,
    dto: UpdateCropCycleDto,
    requestId: string,
  ) {
    const { cycle, parcel, grant } = await this.loadCycle(
      client,
      id,
      "parcels:write",
    );
    if (
      dto.parcel !== undefined &&
      decodeRef("parcel", dto.parcel, "parcel") !== cycle.parcelleId
    ) {
      throw new ProblemException("validation_failed", {
        errors: [
          {
            field: "parcel",
            code: "immutable",
            message: "a crop cycle cannot move to another parcel",
          },
        ],
      });
    }
    Object.assign(cycle, {
      ...(dto.crop !== undefined && { crop: dto.crop }),
      ...(dto.variety !== undefined && { variety: dto.variety }),
      ...(dto.season !== undefined && { season: dto.season }),
      ...(dto.campaign_year !== undefined && {
        campaignYear: dto.campaign_year,
      }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.sown_on !== undefined && { sownOn: dto.sown_on }),
      ...(dto.expected_harvest_on !== undefined && {
        expectedHarvestOn: dto.expected_harvest_on,
      }),
      ...(dto.harvested_on !== undefined && { harvestedOn: dto.harvested_on }),
      ...(dto.yield !== undefined && { yieldKg: dto.yield?.value ?? null }),
      ...(dto.metadata !== undefined && {
        metadata: { ...cycle.metadata, ...dto.metadata },
      }),
    });
    const saved = await this.cycles.save(cycle);
    await this.syncParcelCrop(parcel, saved);
    this.logParcels(client, requestId, [parcel], "write", grant, "crop_cycle");
    const body = presentCropCycle(saved);
    void this.events.emit(
      client.organizationId,
      client.livemode,
      "crop_cycle.updated",
      body,
    );
    return body;
  }

  async listCycles(
    client: PublicClient,
    query: ListCropCyclesQueryDto,
    requestId: string,
  ) {
    const v = this.policy.visibility(
      "c",
      client,
      "parcels:read",
      PARCEL_FARMER_SQL("c"),
    );
    const qb = this.cycles.createQueryBuilder("c").where(v.sql, v.params);
    if (query.parcel) {
      qb.andWhere('"c"."parcelleId" = :parcelId', {
        parcelId: decodeRef("parcel", query.parcel, "parcel"),
      });
    }
    if (query.status)
      qb.andWhere("c.status = :status", { status: query.status });
    if (query.campaign_year) {
      qb.andWhere('"c"."campaignYear" = :year', { year: query.campaign_year });
    }
    const page = await paginate(qb, query);
    const parcels = page.rows.length
      ? await this.parcels.find({
          where: page.rows.map((c) => ({ id: c.parcelleId })),
          select: ["id", "farmerId", "organisationId"],
        })
      : [];
    this.logParcels(
      client,
      requestId,
      parcels,
      "read",
      undefined,
      "crop_cycle",
    );
    return listEnvelope(
      "/v1/crop_cycles",
      page.rows.map(presentCropCycle),
      page,
    );
  }

  /** Loads a visible parcel by public id (path or body), or throws 404 / 422. */
  async loadParcel(
    client: PublicClient,
    id: string,
    scope: PublicScope,
    bodyField?: string,
  ): Promise<{ parcel: Parcelle; grant: Grant }> {
    const uuid = bodyField
      ? decodeRef("parcel", id, bodyField)
      : decodeId("parcel", id);
    const parcel = await this.parcels.findOne({
      where: { id: uuid, deleted: false },
    });
    const grant = parcel
      ? await this.policy.rowGrant(client, parcel, parcel.farmerId, scope)
      : null;
    if (!parcel || !grant) {
      throw new ProblemException("resource_missing", { params: { id } });
    }
    return { parcel, grant };
  }

  private async loadCycle(
    client: PublicClient,
    id: string,
    scope: PublicScope,
  ) {
    const cycle = await this.cycles.findOne({
      where: { id: decodeId("crop_cycle", id), livemode: client.livemode },
    });
    if (!cycle)
      throw new ProblemException("resource_missing", { params: { id } });
    const parcel = await this.parcels.findOne({
      where: { id: cycle.parcelleId },
    });
    const grant = parcel
      ? await this.policy.rowGrant(client, parcel, parcel.farmerId, scope)
      : null;
    if (!parcel || !grant) {
      throw new ProblemException("resource_missing", { params: { id } });
    }
    return { cycle, parcel, grant };
  }

  /** Farmer and farm referenced by a parcel must be managed by the caller. */
  private async resolveOwnership(
    client: PublicClient,
    farmerRef: string | undefined,
    farmRef: string | undefined,
  ): Promise<{ farmer: Farmer | null; farm: Farm | null }> {
    let farm: Farm | null = null;
    if (farmRef) {
      farm = await this.farms.findOne({
        where: {
          id: decodeRef("farm", farmRef, "farm"),
          livemode: client.livemode,
          deletedAt: IsNull(),
        },
      });
      if (!farm)
        throw new ProblemException("resource_missing", {
          params: { id: farmRef },
        });
    }
    const farmerId = farmerRef
      ? decodeRef("farmer", farmerRef, "farmer")
      : farm?.farmerId;
    if (!farmerId) return { farmer: null, farm: null };
    if (farm && farm.farmerId !== farmerId) {
      throw new ProblemException("validation_failed", {
        errors: [
          {
            field: "farm",
            code: "farmer_mismatch",
            message: "farm belongs to another farmer",
          },
        ],
      });
    }
    const { farmer } = await this.policy.farmer(
      client,
      farmerId,
      "parcels:write",
      farmerRef ?? farmRef ?? "",
    );
    return { farmer, farm };
  }

  private async saveParcel(parcel: Parcelle): Promise<Parcelle> {
    try {
      return await this.parcels.save(parcel);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ProblemException("validation_failed", {
          errors: [
            {
              field: "code",
              code: "already_exists",
              message: "parcel code already used",
            },
          ],
        });
      }
      throw err;
    }
  }

  /** The active cycle drives the parcel's "current crop" used by the web app. */
  private async syncParcelCrop(parcel: Parcelle, cycle: CropCycle) {
    if (cycle.status !== "active") return;
    await this.parcels.update(parcel.id, {
      culture: cropToLegacy(cycle.crop as Parameters<typeof cropToLegacy>[0]),
      variete: cycle.variety ?? undefined,
      dateSemis: cycle.sownOn ? new Date(cycle.sownOn) : undefined,
      typeCampagne: SEASONS[cycle.season],
    });
  }

  private logParcels(
    client: PublicClient,
    requestId: string,
    parcels: Pick<Parcelle, "id" | "farmerId" | "organisationId">[],
    action: "read" | "write",
    grant?: Grant,
    resourceType = "parcel",
  ) {
    this.policy.record(
      client,
      requestId,
      parcels
        .filter((p) => p.farmerId)
        .map((p) => ({
          farmerId: p.farmerId!,
          resourceType,
          resourceId: resourceType === "parcel" ? p.id : null,
          action,
          basis: grant?.basis ?? this.policy.basisOf(client, p.organisationId),
          consentId: grant?.consentId ?? null,
        })),
    );
  }
}
