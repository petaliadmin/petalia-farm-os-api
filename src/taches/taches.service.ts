import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Tache, TacheDocument } from "./schemas/tache.schema";
import { CreateTacheDto, UpdateTacheDto } from "./dto/taches.dto";

export interface TacheStats {
  total: number;
  urgentes: number;
  enCours: number;
  terminees: number;
}

@Injectable()
export class TachesService {
  constructor(
    @InjectModel(Tache.name) private tacheModel: Model<TacheDocument>,
  ) {}

  async create(createDto: CreateTacheDto): Promise<Tache> {
    const created = new this.tacheModel(createDto);
    return created.save();
  }

  async findAll(query?: {
    statut?: string;
    assigneeId?: string;
  }): Promise<Tache[]> {
    const filter: any = {};
    if (query?.statut) filter.statut = query.statut;
    if (query?.assigneeId)
      filter.assigneeId = new Types.ObjectId(query.assigneeId);
    return this.tacheModel
      .find(filter)
      .sort({ priorite: -1, datePlanifiee: 1 })
      .exec();
  }

  async findById(id: string): Promise<Tache> {
    const tache = await this.tacheModel.findById(id).exec();
    if (!tache) throw new NotFoundException(`Tache ${id} non trouvée`);
    return tache;
  }

  async update(id: string, updateDto: UpdateTacheDto): Promise<Tache> {
    const updated = await this.tacheModel
      .findByIdAndUpdate(id, updateDto, { new: true })
      .exec();
    if (!updated) throw new NotFoundException(`Tache ${id} non trouvée`);
    return updated;
  }

  async updateStatut(id: string, statut: string): Promise<Tache> {
    const updateData: any = { statut };
    if (statut === "done") {
      updateData.dateTerminee = new Date();
    }
    const updated = await this.tacheModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
    if (!updated) throw new NotFoundException(`Tache ${id} non trouvée`);
    return updated;
  }

  async remove(id: string): Promise<{ data: boolean }> {
    const result = await this.tacheModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException(`Tache ${id} non trouvée`);
    return { data: true };
  }

  async getStats(): Promise<TacheStats> {
    const [total, urgentes, enCours, terminees] = await Promise.all([
      this.tacheModel.countDocuments(),
      this.tacheModel.countDocuments({ priorite: "urgente" }),
      this.tacheModel.countDocuments({ statut: "en_cours" }),
      this.tacheModel.countDocuments({ statut: "done" }),
    ]);
    return { total, urgentes, enCours, terminees };
  }

  async findUrgentes(): Promise<Tache[]> {
    return this.tacheModel
      .find({ priorite: "urgente", statut: { $ne: "done" } })
      .exec();
  }

  async getKanban(): Promise<{
    todo: Tache[];
    en_cours: Tache[];
    done: Tache[];
    reporte: Tache[];
  }> {
    const [todo, en_cours, done, reporte] = await Promise.all([
      this.tacheModel
        .find({ statut: "todo" })
        .sort({ priorite: -1, datePlanifiee: 1 })
        .limit(20)
        .exec(),
      this.tacheModel
        .find({ statut: "en_cours" })
        .sort({ datePlanifiee: 1 })
        .limit(20)
        .exec(),
      this.tacheModel
        .find({ statut: "done" })
        .sort({ dateTerminee: -1 })
        .limit(20)
        .exec(),
      this.tacheModel
        .find({ statut: "reporte" })
        .sort({ datePlanifiee: 1 })
        .limit(20)
        .exec(),
    ]);
    return { todo, en_cours, done, reporte };
  }
}
