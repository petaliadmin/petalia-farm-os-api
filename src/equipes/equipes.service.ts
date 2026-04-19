import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Equipe, EquipeDocument } from "./schemas/equipe.schema";

@Injectable()
export class EquipesService {
  constructor(
    @InjectModel(Equipe.name) private equipeModel: Model<EquipeDocument>,
  ) {}

  async findAll(organisationId?: string): Promise<Equipe[]> {
    const filter = organisationId
      ? { organisationId: new Types.ObjectId(organisationId) }
      : {};
    return this.equipeModel.find(filter).sort({ nom: 1 }).exec();
  }

  async findById(id: string): Promise<Equipe> {
    const equipe = await this.equipeModel.findById(id).exec();
    if (!equipe) throw new NotFoundException(`Équipe ${id} non trouvée`);
    return equipe;
  }

  async create(data: Partial<Equipe>): Promise<Equipe> {
    return new this.equipeModel(data).save();
  }

  async update(id: string, data: Partial<Equipe>): Promise<Equipe> {
    const updated = await this.equipeModel
      .findByIdAndUpdate(id, data, { new: true })
      .exec();
    if (!updated) throw new NotFoundException(`Équipe ${id} non trouvée`);
    return updated;
  }

  async remove(id: string): Promise<{ data: boolean }> {
    await this.equipeModel.findByIdAndDelete(id).exec();
    return { data: true };
  }

  async getMembres(id: string): Promise<any[]> {
    // Would fetch users with this equipeId
    return [];
  }
}
