import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { PublicClient } from "../common/context";
import { isUniqueViolation } from "../common/db";
import { assertPoint } from "../common/geo";
import { decodeId, decodeRef, encodeId } from "../common/ids";
import { listEnvelope, paginate } from "../common/pagination";
import { normalizePhone } from "../common/phone";
import { presentFarm, presentFarmer } from "../common/presenters";
import { ProblemException } from "../common/problem";
import { AccessPolicy } from "../consents/access-policy.service";
import {
  CreateFarmDto,
  CreateFarmerDto,
  ListFarmersQueryDto,
  ListFarmsQueryDto,
  UpdateFarmDto,
  UpdateFarmerDto,
} from "../dto/farmers.dto";
import { Farm } from "../entities/farm.entity";
import { Farmer } from "../entities/farmer.entity";
import { EventsService } from "../events/events.service";

@Injectable()
export class FarmersService {
  constructor(
    @InjectRepository(Farmer) private readonly farmers: Repository<Farmer>,
    @InjectRepository(Farm) private readonly farms: Repository<Farm>,
    private readonly policy: AccessPolicy,
    private readonly events: EventsService,
  ) {}

  async create(client: PublicClient, dto: CreateFarmerDto, requestId: string) {
    const phone = normalizePhone(dto.phone);
    const existing = await this.farmers.findOne({
      where: { phone, livemode: client.livemode },
    });
    if (existing) throw this.alreadyRegistered(client, existing);

    let farmer: Farmer;
    try {
      farmer = await this.farmers.save(
        this.farmers.create({
          livemode: client.livemode,
          organisationId: client.organizationId,
          phone,
          firstName: dto.first_name,
          lastName: dto.last_name,
          gender: dto.gender ?? null,
          birthYear: dto.birth_year ?? null,
          preferredLanguage: dto.preferred_language ?? "fr",
          preferredChannel: dto.preferred_channel ?? "sms",
          locality: dto.locality ?? null,
          region: dto.region ?? null,
          country: dto.country ?? "SN",
          metadata: dto.metadata ?? {},
        }),
      );
    } catch (err) {
      if (isUniqueViolation(err)) {
        const winner = await this.farmers.findOne({
          where: { phone, livemode: client.livemode },
        });
        throw this.alreadyRegistered(client, winner);
      }
      throw err;
    }

    const body = presentFarmer(farmer);
    this.policy.record(client, requestId, [
      {
        farmerId: farmer.id,
        resourceType: "farmer",
        resourceId: farmer.id,
        action: "write",
        basis: "delegate",
      },
    ]);
    void this.events.emit(
      client.organizationId,
      client.livemode,
      "farmer.created",
      body,
    );
    return body;
  }

  async retrieve(client: PublicClient, id: string, requestId: string) {
    const { farmer, grant } = await this.policy.farmer(
      client,
      decodeId("farmer", id),
      "farmers:read",
      id,
    );
    this.policy.record(client, requestId, [
      {
        farmerId: farmer.id,
        resourceType: "farmer",
        resourceId: farmer.id,
        action: "read",
        ...grant,
      },
    ]);
    return presentFarmer(farmer);
  }

  async update(
    client: PublicClient,
    id: string,
    dto: UpdateFarmerDto,
    requestId: string,
  ) {
    const { farmer, grant } = await this.policy.farmer(
      client,
      decodeId("farmer", id),
      "farmers:write",
      id,
    );
    Object.assign(farmer, {
      ...(dto.first_name !== undefined && { firstName: dto.first_name }),
      ...(dto.last_name !== undefined && { lastName: dto.last_name }),
      ...(dto.gender !== undefined && { gender: dto.gender }),
      ...(dto.birth_year !== undefined && { birthYear: dto.birth_year }),
      ...(dto.preferred_language !== undefined && {
        preferredLanguage: dto.preferred_language,
      }),
      ...(dto.preferred_channel !== undefined && {
        preferredChannel: dto.preferred_channel,
      }),
      ...(dto.locality !== undefined && { locality: dto.locality }),
      ...(dto.region !== undefined && { region: dto.region }),
      ...(dto.country !== undefined && { country: dto.country }),
      ...(dto.metadata !== undefined && {
        metadata: { ...farmer.metadata, ...dto.metadata },
      }),
    });
    const saved = await this.farmers.save(farmer);
    const body = presentFarmer(saved);
    this.policy.record(client, requestId, [
      {
        farmerId: farmer.id,
        resourceType: "farmer",
        resourceId: farmer.id,
        action: "write",
        ...grant,
      },
    ]);
    void this.events.emit(
      client.organizationId,
      client.livemode,
      "farmer.updated",
      body,
    );
    return body;
  }

  async list(
    client: PublicClient,
    query: ListFarmersQueryDto,
    requestId: string,
  ) {
    const v = this.policy.visibility("f", client, "farmers:read", '"f"."id"');
    const qb = this.farmers
      .createQueryBuilder("f")
      .where(v.sql, v.params)
      .andWhere('"f"."deletedAt" IS NULL');
    if (query.phone) {
      qb.andWhere("f.phone = :phone", {
        phone: normalizePhone(query.phone, "phone"),
      });
    }
    const page = await paginate(qb, query);
    this.policy.record(
      client,
      requestId,
      page.rows.map((f) => ({
        farmerId: f.id,
        resourceType: "farmer",
        resourceId: f.id,
        action: "read" as const,
        basis: this.policy.basisOf(client, f.organisationId),
      })),
    );
    return listEnvelope("/v1/farmers", page.rows.map(presentFarmer), page);
  }

  async createFarm(
    client: PublicClient,
    dto: CreateFarmDto,
    requestId: string,
  ) {
    const { farmer, grant } = await this.policy.farmer(
      client,
      decodeRef("farmer", dto.farmer, "farmer"),
      "farmers:write",
      dto.farmer,
    );
    const farm = await this.farms.save(
      this.farms.create({
        livemode: client.livemode,
        organisationId: client.organizationId,
        farmerId: farmer.id,
        name: dto.name,
        locality: dto.locality ?? farmer.locality,
        region: dto.region ?? farmer.region,
        location: dto.location ? assertPoint(dto.location) : null,
        metadata: dto.metadata ?? {},
      }),
    );
    this.policy.record(client, requestId, [
      {
        farmerId: farmer.id,
        resourceType: "farm",
        resourceId: farm.id,
        action: "write",
        ...grant,
      },
    ]);
    return presentFarm(farm);
  }

  async retrieveFarm(client: PublicClient, id: string, requestId: string) {
    const { farm, grant } = await this.loadFarm(client, id, "farmers:read");
    this.policy.record(client, requestId, [
      {
        farmerId: farm.farmerId,
        resourceType: "farm",
        resourceId: farm.id,
        action: "read",
        ...grant,
      },
    ]);
    return presentFarm(farm);
  }

  async updateFarm(
    client: PublicClient,
    id: string,
    dto: UpdateFarmDto,
    requestId: string,
  ) {
    const { farm, grant } = await this.loadFarm(client, id, "farmers:write");
    Object.assign(farm, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.locality !== undefined && { locality: dto.locality }),
      ...(dto.region !== undefined && { region: dto.region }),
      ...(dto.location !== undefined && {
        location: assertPoint(dto.location),
      }),
      ...(dto.metadata !== undefined && {
        metadata: { ...farm.metadata, ...dto.metadata },
      }),
    });
    const saved = await this.farms.save(farm);
    this.policy.record(client, requestId, [
      {
        farmerId: farm.farmerId,
        resourceType: "farm",
        resourceId: farm.id,
        action: "write",
        ...grant,
      },
    ]);
    return presentFarm(saved);
  }

  async listFarms(
    client: PublicClient,
    query: ListFarmsQueryDto,
    requestId: string,
  ) {
    const v = this.policy.visibility(
      "fa",
      client,
      "farmers:read",
      '"fa"."farmerId"',
    );
    const qb = this.farms
      .createQueryBuilder("fa")
      .where(v.sql, v.params)
      .andWhere('"fa"."deletedAt" IS NULL');
    if (query.farmer) {
      qb.andWhere('"fa"."farmerId" = :farmerId', {
        farmerId: decodeRef("farmer", query.farmer, "farmer"),
      });
    }
    const page = await paginate(qb, query);
    this.policy.record(
      client,
      requestId,
      page.rows.map((f) => ({
        farmerId: f.farmerId,
        resourceType: "farm",
        action: "read" as const,
        basis: this.policy.basisOf(client, f.organisationId),
      })),
    );
    return listEnvelope("/v1/farms", page.rows.map(presentFarm), page);
  }

  private async loadFarm(
    client: PublicClient,
    id: string,
    scope: "farmers:read" | "farmers:write",
  ) {
    const farm = await this.farms.findOne({
      where: {
        id: decodeId("farm", id),
        livemode: client.livemode,
        deletedAt: IsNull(),
      },
    });
    if (!farm)
      throw new ProblemException("resource_missing", { params: { id } });
    const { grant } = await this.policy.farmer(
      client,
      farm.farmerId,
      scope,
      id,
    );
    return { farm, grant };
  }

  /** Only the farmer's own organisation learns the existing id. */
  private alreadyRegistered(client: PublicClient, existing: Farmer | null) {
    return new ProblemException("farmer_already_registered", {
      extensions:
        existing && existing.organisationId === client.organizationId
          ? { farmer: encodeId("farmer", existing.id) }
          : {},
    });
  }
}
