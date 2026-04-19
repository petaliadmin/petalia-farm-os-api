import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Visite, VisiteDocument } from "./schemas/visite.schema";
import { CreateVisiteDto, UpdateVisiteDto } from "./dto/visites.dto";

export interface VisiteStats {
  total: number;
  completees: number;
  planifiees: number;
  enCours: number;
}

@Injectable()
export class VisitesService {
  constructor(
    @InjectModel(Visite.name) private visiteModel: Model<VisiteDocument>,
  ) {}

  async create(createDto: CreateVisiteDto): Promise<Visite> {
    const created = new this.visiteModel(createDto);
    return created.save();
  }

  async findAll(query?: {
    organisationId?: string;
    technicianId?: string;
    statut?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Visite[];
    meta: { total: number; page: number; limit: number };
  }> {
    const filter: any = {};
    if (query?.organisationId) {
      filter.organisationId = new Types.ObjectId(query.organisationId);
    }
    if (query?.technicianId) {
      filter.technicianId = new Types.ObjectId(query.technicianId);
    }
    if (query?.statut) {
      filter.statut = query.statut;
    }

    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.visiteModel
        .find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.visiteModel.countDocuments(filter),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findById(id: string): Promise<Visite> {
    const visite = await this.visiteModel.findById(id).exec();
    if (!visite) {
      throw new NotFoundException(`Visite with ID ${id} not found`);
    }
    return visite;
  }

  async update(id: string, updateDto: UpdateVisiteDto): Promise<Visite> {
    const existing = await this.visiteModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException(`Visite with ID ${id} not found`);
    }

    // Auto-generate PDF rapport when status changes to completee
    if (updateDto.statut === "completee" && existing.statut !== "completee") {
      // Queue PDF generation job (would be handled by Bull in production)
      // For now, we'll set the rapport URL after processing
    }

    const updated = await this.visiteModel
      .findByIdAndUpdate(id, updateDto, { new: true })
      .exec();
    return updated!;
  }

  async remove(id: string): Promise<{ data: boolean }> {
    const result = await this.visiteModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Visite with ID ${id} not found`);
    }
    return { data: true };
  }

  async findRecentes(limit: number = 5): Promise<Visite[]> {
    return this.visiteModel
      .find({ statut: { $ne: "annulee" } })
      .sort({ date: -1 })
      .limit(limit)
      .exec();
  }

  async findStats(organisationId?: string): Promise<VisiteStats> {
    const filter: any = {};
    if (organisationId) {
      filter.organisationId = new Types.ObjectId(organisationId);
    }

    const [total, completees, planifiees, enCours] = await Promise.all([
      this.visiteModel.countDocuments(filter),
      this.visiteModel.countDocuments({ ...filter, statut: "completee" }),
      this.visiteModel.countDocuments({ ...filter, statut: "planifiee" }),
      this.visiteModel.countDocuments({ ...filter, statut: "en_cours" }),
    ]);

    return { total, completees, planifiees, enCours };
  }

  async getActiviteSemaine(): Promise<{ jour: string; count: number }[]> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const visites = await this.visiteModel
      .find({
        date: { $gte: startOfWeek, $lte: endOfWeek },
        statut: { $ne: "annulee" },
      })
      .exec();

    const jours = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    const counts = jours.map((jour) => ({ jour, count: 0 }));

    visites.forEach((v) => {
      const jourIndex = new Date(v.date).getDay() - 1;
      const adjustedIndex = jourIndex < 0 ? 6 : jourIndex;
      counts[adjustedIndex].count++;
    });

    return counts;
  }

  async findByParcelle(parcelleId: string): Promise<Visite[]> {
    return this.visiteModel
      .find({ parcelleId: new Types.ObjectId(parcelleId) })
      .sort({ date: -1 })
      .exec();
  }

  async uploadPhotos(
    id: string,
    photos: string[],
  ): Promise<{ data: { photos: string[] } }> {
    const visite = await this.visiteModel
      .findByIdAndUpdate(
        id,
        { $push: { photos: { $each: photos } } },
        { new: true },
      )
      .exec();
    if (!visite) throw new NotFoundException(`Visite ${id} non trouvée`);
    return { data: { photos: visite.photos || [] } };
  }

  async getRapport(
    id: string,
  ): Promise<{ data: { url: string; nom: string } }> {
    const visite = await this.findById(id);
    if (visite.rapport) {
      return { data: { url: visite.rapport, nom: `Rapport_${id}.pdf` } };
    }
    return this.generateRapport(id);
  }

  async generateRapport(
    id: string,
  ): Promise<{ data: { url: string; nom: string } }> {
    // In production, would generate PDF via PDFKit and upload to Cloudinary
    const url = `https://cdn.cloudinary.com/petalia/rapports/Rapport_${id}.pdf`;
    await this.visiteModel.findByIdAndUpdate(id, { rapport: url });
    return { data: { url, nom: `Rapport_${id}.pdf` } };
  }
}
