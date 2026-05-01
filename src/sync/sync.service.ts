import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DeepPartial, Repository } from "typeorm";
import { AgroRule } from "./entities/agro-rule.entity";
import { ExpertRequest } from "./entities/expert-request.entity";
import { Parcelle } from "../parcelles/entities/parcelle.entity";

interface SyncActionExpertRequest {
  type: "expert_request.submit";
  data: {
    parcelId: string;
    photoPaths?: string[];
    context: string;
  };
}

export type SyncAction = SyncActionExpertRequest;

interface SyncError {
  action: string;
  error: string;
}

interface SyncConflict {
  entityType: string;
  entityId: string;
  serverVersion: unknown;
  clientVersion: unknown;
}

interface FlutterParcel {
  id: string;
  name: string;
  owner: string;
  village: string;
  crop: string;
  growthStage: string;
  irrigation: string;
  healthScore: number;
  lastVisit: string;
  estimatedYield: number;
  boundary: Array<[number, number]>;
  variety?: string;
  semisDate?: string;
  region?: string;
  soilType?: string;
  previousCrop?: string;
}

interface SyncPushResult {
  processed: number;
  errors: SyncError[];
  conflicts: SyncConflict[];
  serverTimestamp: string;
}

interface SyncPullResult {
  parcels: FlutterParcel[];
  agro_rules: AgroRule[];
  serverTimestamp: string;
}

@Injectable()
export class SyncService {
  constructor(
    @InjectRepository(AgroRule)
    private agroRuleRepo: Repository<AgroRule>,
    @InjectRepository(ExpertRequest)
    private expertRequestRepo: Repository<ExpertRequest>,
    @InjectRepository(Parcelle)
    private parcelleRepo: Repository<Parcelle>,
  ) {}

  async getAgroRules(
    since?: string,
  ): Promise<{ schemaVersion: number; updatedAt: string; rules: AgroRule[] }> {
    const qb = this.agroRuleRepo
      .createQueryBuilder("r")
      .where("r.actif = true");
    if (since) qb.andWhere("r.updatedAt >= :since", { since: new Date(since) });
    const rules = await qb.getMany();
    return { schemaVersion: 1, updatedAt: new Date().toISOString(), rules };
  }

  async createExpertRequest(data: {
    parcelId: string;
    photoPaths?: string[];
    context: string;
  }): Promise<{ id: string; status: string; receivedAt: string }> {
    const request = await this.expertRequestRepo.save(
      this.expertRequestRepo.create(data as DeepPartial<ExpertRequest>),
    );
    return {
      id: request.id,
      status: "received",
      receivedAt: new Date().toISOString(),
    };
  }

  async pushSync(actions: SyncAction[]): Promise<SyncPushResult> {
    const errors: SyncError[] = [];
    let processed = 0;

    for (const action of actions) {
      try {
        if (action.type === "expert_request.submit") {
          await this.createExpertRequest(action.data);
        }
        processed++;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        errors.push({ action: action.type, error: message });
      }
    }

    return {
      processed,
      errors,
      conflicts: [],
      serverTimestamp: new Date().toISOString(),
    };
  }

  async pullSync(since: string, resources: string): Promise<SyncPullResult> {
    const resourceList = resources.split(",");
    const result: SyncPullResult = {
      parcels: [],
      agro_rules: [],
      serverTimestamp: new Date().toISOString(),
    };

    if (
      resourceList.includes("parcelles") ||
      resourceList.includes("parcels")
    ) {
      const qb = this.parcelleRepo
        .createQueryBuilder("p")
        .where("p.deleted = false");
      if (since)
        qb.andWhere("p.updatedAt >= :since", { since: new Date(since) });
      const parcelles = await qb.getMany();
      result.parcels = parcelles.map(this.toFlutterParcel);
    }

    if (resourceList.includes("agro_rules")) {
      result.agro_rules = await this.agroRuleRepo.find({
        where: { actif: true },
      });
    }

    return result;
  }

  private toFlutterParcel(p: Parcelle): FlutterParcel {
    const boundary = p.boundary as {
      coordinates?: Array<[number, number][]>;
    } | null;
    return {
      id: p.id,
      name: p.nom,
      owner: p.producteurNom,
      village: p.localite || "",
      crop: p.culture,
      growthStage: p.stade || "vegetative",
      irrigation: p.sourceEau || "rainfed",
      healthScore: p.healthScore || 0,
      lastVisit: p.derniereVisite?.toISOString() || new Date().toISOString(),
      estimatedYield: p.rendementPrecedent || 0,
      boundary:
        boundary?.coordinates?.[0]
          ?.slice(0, -1)
          .map(([lng, lat]: [number, number]) => [lat, lng]) || [],
      variety: p.variete,
      semisDate: p.dateSemis?.toISOString(),
      region: p.region,
      soilType: p.typeSol,
      previousCrop: p.culturePrecedente,
    };
  }

  async getSyncStatus(): Promise<{ pending: number; lastSync: string }> {
    return { pending: 0, lastSync: new Date().toISOString() };
  }
}
