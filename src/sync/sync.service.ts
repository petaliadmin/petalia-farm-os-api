import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { AgroRule, AgroRuleDocument } from "./schemas/agro-rule.schema";
import {
  ExpertRequest,
  ExpertRequestDocument,
} from "./schemas/expert-request.schema";
import {
  Parcelle,
  ParcelleDocument,
} from "../parcelles/schemas/parcelle.schema";

@Injectable()
export class SyncService {
  constructor(
    @InjectModel(AgroRule.name) private agroRuleModel: Model<AgroRuleDocument>,
    @InjectModel(ExpertRequest.name)
    private expertRequestModel: Model<ExpertRequestDocument>,
    @InjectModel(Parcelle.name) private parcelleModel: Model<ParcelleDocument>,
  ) {}

  async getAgroRules(since?: string): Promise<{
    schemaVersion: number;
    updatedAt: string;
    rules: any[];
  }> {
    const filter: any = { actif: true };
    if (since) {
      filter.updatedAt = { $gte: new Date(since) };
    }
    const rules = await this.agroRuleModel.find(filter).exec();
    return {
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      rules,
    };
  }

  async createExpertRequest(data: any): Promise<{
    id: string;
    status: string;
    receivedAt: string;
  }> {
    const request = new this.expertRequestModel(data);
    await request.save();
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
    // Process offline actions from Flutter
    const errors: any[] = [];
    const conflicts: any[] = [];
    let processed = 0;

    for (const action of actions) {
      try {
        switch (action.type) {
          case "observation.create":
            // Handle observation creation
            processed++;
            break;
          case "expert_request.submit":
            await this.createExpertRequest(action.data);
            processed++;
            break;
          default:
            processed++;
        }
      } catch (e: any) {
        errors.push({ action: action.type, error: e.message });
      }
    }

    return {
      processed,
      errors,
      conflicts,
      serverTimestamp: new Date().toISOString(),
    };
  }

  async pullSync(
    since: string,
    resources: string,
  ): Promise<{
    parcels: any[];
    agro_rules: any[];
    serverTimestamp: string;
  }> {
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
      const filter: any = { deleted: false };
      if (since) {
        filter.updatedAt = { $gte: new Date(since) };
      }
      const parcelles = await this.parcelleModel.find(filter).exec();
      result.parcels = parcelles.map(this.toFlutterParcel);
    }

    if (resourceList.includes("agro_rules")) {
      const rules = await this.agroRuleModel.find({ actif: true }).exec();
      result.agro_rules = rules;
    }

    return result;
  }

  private toFlutterParcel(p: ParcelleDocument): any {
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
        p.boundary?.coordinates?.[0]
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
    // Would track pending items in Redis
    return { pending: 0, lastSync: new Date().toISOString() };
  }
}
