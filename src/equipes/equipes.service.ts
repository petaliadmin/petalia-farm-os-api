import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Equipe, EquipeDocument } from "./schemas/equipe.schema";
import { UsersService } from "../users/users.service";

@Injectable()
export class EquipesService {
  constructor(
    @InjectModel(Equipe.name) private equipeModel: Model<EquipeDocument>,
    private usersService: UsersService,
  ) {}

  async findAll(query?: {
    organisationId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Equipe[];
    meta: { total: number; page: number; limit: number };
  }> {
    const filter = query?.organisationId
      ? { organisationId: new Types.ObjectId(query.organisationId) }
      : {};

    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.equipeModel
        .find(filter)
        .sort({ nom: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.equipeModel.countDocuments(filter),
    ]);

    return { data, meta: { total, page, limit } };
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
    await this.findById(id);
    return this.usersService.findByEquipage(id);
  }
}
