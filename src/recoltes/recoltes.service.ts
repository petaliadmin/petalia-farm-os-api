import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Recolte, RecolteDocument } from "./schemas/recolte.schema";
import { CreateRecolteDto, UpdateRecolteDto } from "./dto/recoltes.dto";

@Injectable()
export class RecoltesService {
  constructor(
    @InjectModel(Recolte.name) private recolteModel: Model<RecolteDocument>,
  ) {}

  async create(createDto: CreateRecolteDto): Promise<Recolte> {
    // Server recalculates all computed fields
    const recolteData = { ...createDto };
    // The pre-save hook handles yield, loss rate, and revenue calculations
    const created = new this.recolteModel(recolteData);
    return created.save();
  }

  async findAll(query?: {
    parcelleId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Recolte[];
    meta: { total: number; page: number; limit: number };
  }> {
    const filter: any = {};
    if (query?.parcelleId) {
      filter.parcelleId = new Types.ObjectId(query.parcelleId);
    }

    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.recolteModel
        .find(filter)
        .sort({ dateRecolte: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.recolteModel.countDocuments(filter),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findById(id: string): Promise<Recolte> {
    const recolte = await this.recolteModel.findById(id).exec();
    if (!recolte) throw new NotFoundException(`Recolte ${id} non trouvée`);
    return recolte;
  }

  async update(id: string, updateDto: UpdateRecolteDto): Promise<Recolte> {
    // Recalculates computed fields after update
    const updated = await this.recolteModel
      .findByIdAndUpdate(id, updateDto, { new: true })
      .exec();
    if (!updated) throw new NotFoundException(`Recolte ${id} non trouvée`);
    return updated;
  }

  async remove(id: string): Promise<{ data: boolean }> {
    await this.recolteModel.findByIdAndDelete(id).exec();
    return { data: true };
  }

  async findByParcelle(parcelleId: string): Promise<Recolte[]> {
    return this.recolteModel
      .find({ parcelleId: new Types.ObjectId(parcelleId) })
      .sort({ dateRecolte: -1 })
      .exec();
  }

  async valider(id: string): Promise<Recolte> {
    const updated = await this.recolteModel
      .findByIdAndUpdate(id, { statut: "validee" }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException(`Recolte ${id} non trouvée`);
    return updated;
  }
}
