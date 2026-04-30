import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AgroRule } from "./entities/agro-rule.entity";
import { ExpertRequest } from "./entities/expert-request.entity";
import { Parcelle } from "../parcelles/entities/parcelle.entity";

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

  async createExpertRequest(
    data: any,
  ): Promise<{ id: string; status: string; receivedAt: string }> {
    const request = await this.expertRequestRepo.save(
      this.expertRequestRepo.create(data),
    );
    return {
      id: request.id,
      status: "received",
      receivedAt: new Date().toISOString(),
    };
  }

  async pushSync(actions: any[]): Promise<{
    processed: number;
    errors: any[];
    conflicts: any[];
    serverTimestamp: string;
  }> {
    const errors: any[] = [];
    let processed = 0;

    for (const action of actions) {
      try {
        if (action.type === "expert_request.submit") {
          await this.createExpertRequest(action.data);
        }
        processed++;
      } catch (e: any) {
        errors.push({ action: action.type, error: e.message });
      }
    }

    return {
      processed,
      errors,
      conflicts: [],
      serverTimestamp: new Date().toISOString(),
    };
  }

  async pullSync(
    since: string,
    resources: string,
  ): Promise<{ parcels: any[]; agro_rules: any[]; serverTimestamp: string }> {
    const resourceList = resources.split(",");
    const result: any = {
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

  private toFlutterParcel(p: Parcelle): any {
    const boundary = p.boundary as any;
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
