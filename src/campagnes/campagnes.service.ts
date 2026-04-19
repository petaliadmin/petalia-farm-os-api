import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Campagne, CampagneDocument } from "./schemas/campagne.schema";

@Injectable()
export class CampagnesService {
  constructor(
    @InjectModel(Campagne.name) private campagneModel: Model<CampagneDocument>,
  ) {}

  async create(data: Partial<Campagne>): Promise<Campagne> {
    return new this.campagneModel(data).save();
  }

  async findAll(organisationId?: string): Promise<Campagne[]> {
    const filter = organisationId
      ? { organisationId: new Types.ObjectId(organisationId) }
      : {};
    return this.campagneModel.find(filter).sort({ dateDebut: -1 }).exec();
  }

  async findById(id: string): Promise<Campagne> {
    const campagne = await this.campagneModel.findById(id).exec();
    if (!campagne) throw new NotFoundException(`Campagne ${id} non trouvée`);
    return campagne;
  }

  async update(id: string, data: Partial<Campagne>): Promise<Campagne> {
    const updated = await this.campagneModel
      .findByIdAndUpdate(id, data, { new: true })
      .exec();
    if (!updated) throw new NotFoundException(`Campagne ${id} non trouvée`);
    return updated;
  }

  async cloture(
    id: string,
    data: {
      dateFin?: string;
      rendementFinal?: number;
      observationsCloture?: string;
    },
  ): Promise<Campagne> {
    const updateData: any = {
      statut: "terminee",
      progressionPct: 100,
      dateFin: new Date(data.dateFin || new Date().toISOString().split("T")[0]),
    };
    if (data.rendementFinal) updateData.rendementFinal = data.rendementFinal;
    if (data.observationsCloture)
      updateData.observationsCloture = data.observationsCloture;

    const updated = await this.campagneModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
    if (!updated) throw new NotFoundException(`Campagne ${id} non trouvée`);
    return updated;
  }

  async activer(id: string): Promise<Campagne> {
    const updated = await this.campagneModel
      .findByIdAndUpdate(id, { statut: "en_cours" }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException(`Campagne ${id} non trouvée`);
    return updated;
  }

  async remove(id: string): Promise<{ data: boolean }> {
    await this.campagneModel.findByIdAndDelete(id).exec();
    return { data: true };
  }

  async findByParcelle(parcelleId: string): Promise<Campagne[]> {
    return this.campagneModel
      .find({
        /* parcelleId would be filtered via another collection */
      })
      .sort({ dateDebut: -1 })
      .exec();
  }

  async getTaches(campagneId: string): Promise<any[]> {
    const { Tache } = await import("../taches/schemas/tache.schema");
    const TacheModel = this.campagneModel.db.model(Tache.name);
    return TacheModel.find({
      campagneId: new Types.ObjectId(campagneId),
    }).exec();
  }

  async generateTaches(campagneId: string): Promise<any[]> {
    // In production, would generate tasks based on campaign type and parcelles
    const { Tache } = await import("../taches/schemas/tache.schema");
    const TacheModel = this.campagneModel.db.model(Tache.name);
    const tasks = [
      {
        titre: "Inspection parcelles",
        priorite: "haute",
        campagneId: new Types.ObjectId(campagneId),
      },
      {
        titre: "Application intrants",
        priorite: "normale",
        campagneId: new Types.ObjectId(campagneId),
      },
    ];
    return TacheModel.insertMany(tasks);
  }
}
