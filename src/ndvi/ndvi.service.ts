import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { NdviData, NdviDataDocument } from "./schemas/ndvi.schema";

@Injectable()
export class NdviService {
  constructor(
    @InjectModel(NdviData.name) private ndviModel: Model<NdviDataDocument>,
  ) {}

  async getByParcelle(parcelleId: string): Promise<NdviData[]> {
    return this.ndviModel
      .find({ parcelleId: new Types.ObjectId(parcelleId) })
      .sort({ date: -1 })
      .limit(20)
      .exec();
  }

  async getLatest(parcelleId: string): Promise<NdviData | null> {
    return this.ndviModel
      .findOne({ parcelleId: new Types.ObjectId(parcelleId) })
      .sort({ date: -1 })
      .exec();
  }

  async getDashboard(): Promise<
    { zone: string; ndviMoyen: number; tendance: string }[]
  > {
    // Would aggregate by zone in production
    return [
      { zone: "Walo", ndviMoyen: 0.72, tendance: "stable" },
      { zone: "Ross Béthio", ndviMoyen: 0.65, tendance: "hausse" },
      { zone: "Thies", ndviMoyen: 0.58, tendance: "baisse" },
    ];
  }

  getNdviClasse(ndvi: number): string {
    if (ndvi < 0.3) return "stress";
    if (ndvi < 0.6) return "attention";
    return "sain";
  }

  async fetchNdvi(parcelleId: string): Promise<{ data: { jobId: string } }> {
    // In production, would queue a Bull job to fetch from Sentinel Hub
    const jobId = `ndvi-job-${Date.now()}`;
    return { data: { jobId } };
  }
}
