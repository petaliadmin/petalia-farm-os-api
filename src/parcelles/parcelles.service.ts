import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Parcelle, ParcelleDocument } from "./schemas/parcelle.schema";
import { CreateParcelleDto, UpdateParcelleDto } from "./dto/parcelles.dto";
import { ParcelleStats } from "./interfaces/parcelle.interface";

@Injectable()
export class ParcellesService {
  constructor(
    @InjectModel(Parcelle.name) private parcelleModel: Model<ParcelleDocument>,
  ) {}

  async create(createDto: CreateParcelleDto): Promise<Parcelle> {
    const created = new this.parcelleModel(createDto);
    return created.save();
  }

  async findAll(query?: {
    organisationId?: string;
    technicienId?: string;
    statut?: string;
    culture?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Parcelle[];
    meta: { total: number; page: number; limit: number };
  }> {
    const filter: any = { deleted: false };
    if (query?.organisationId) {
      filter.organisationId = new Types.ObjectId(query.organisationId);
    }
    if (query?.technicienId) {
      filter.technicienId = new Types.ObjectId(query.technicienId);
    }
    if (query?.statut) {
      filter.statut = query.statut;
    }
    if (query?.culture) {
      filter.culture = query.culture;
    }

    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.parcelleModel
        .find(filter)
        .sort({ code: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.parcelleModel.countDocuments(filter),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findById(id: string): Promise<Parcelle> {
    const parcelle = await this.parcelleModel.findById(id).exec();
    if (!parcelle) {
      throw new NotFoundException(`Parcelle with ID ${id} not found`);
    }
    return parcelle;
  }

  async update(id: string, updateDto: UpdateParcelleDto): Promise<Parcelle> {
    const updated = await this.parcelleModel
      .findByIdAndUpdate(id, updateDto, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(`Parcelle with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: string): Promise<{ data: boolean }> {
    // Soft delete
    const result = await this.parcelleModel
      .findByIdAndUpdate(id, { deleted: true }, { new: true })
      .exec();
    if (!result) {
      throw new NotFoundException(`Parcelle with ID ${id} not found`);
    }
    return { data: true };
  }

  async findStats(organisationId?: string): Promise<ParcelleStats> {
    const filter: any = { deleted: false };
    if (organisationId) {
      filter.organisationId = new Types.ObjectId(organisationId);
    }

    const total = await this.parcelleModel.countDocuments(filter);
    const urgentes = await this.parcelleModel.countDocuments({
      ...filter,
      statut: "urgent",
    });
    const enAttention = await this.parcelleModel.countDocuments({
      ...filter,
      statut: "attention",
    });
    const result = await this.parcelleModel.aggregate([
      { $match: filter },
      { $group: { _id: null, totalHa: { $sum: "$superficie" } } },
    ]);
    const totalHa = result[0]?.totalHa || 0;

    return { total, urgentes, enAttention, totalHa };
  }

  async findUrgentes(organisationId?: string): Promise<Parcelle[]> {
    const filter: any = {
      deleted: false,
      statut: { $in: ["urgent", "attention"] },
    };
    if (organisationId) {
      filter.organisationId = new Types.ObjectId(organisationId);
    }
    return this.parcelleModel.find(filter).sort({ superficie: -1 }).exec();
  }

  async findNearby(
    lat: number,
    lng: number,
    rayon: number,
  ): Promise<Parcelle[]> {
    return this.parcelleModel
      .find({
        deleted: false,
        centroid: {
          $near: {
            $geometry: { type: "Point", coordinates: [lng, lat] },
            $maxDistance: rayon,
          },
        },
      })
      .exec();
  }

  async findByCode(code: string): Promise<Parcelle | null> {
    return this.parcelleModel.findOne({ code, deleted: false }).exec();
  }

  async getGeoJSON(): Promise<any> {
    const parcelles = await this.parcelleModel.find({ deleted: false }).exec();
    return {
      type: "FeatureCollection",
      features: parcelles.map((p) => ({
        type: "Feature",
        geometry: p.boundary,
        properties: {
          id: p.id,
          code: p.code,
          nom: p.nom,
          superficie: p.superficie,
          culture: p.culture,
          statut: p.statut,
        },
      })),
    };
  }

  async getVisites(parcelleId: string): Promise<any[]> {
    const { Visite } = await import("../visites/schemas/visite.schema");
    const VisiteModel = this.parcelleModel.db.model(Visite.name);
    return VisiteModel.find({ parcelleId: new Types.ObjectId(parcelleId) })
      .sort({ date: -1 })
      .exec();
  }

  async getTaches(parcelleId: string): Promise<any[]> {
    const { Tache } = await import("../taches/schemas/tache.schema");
    const TacheModel = this.parcelleModel.db.model(Tache.name);
    return TacheModel.find({
      parcelleId: new Types.ObjectId(parcelleId),
    }).exec();
  }

  async getCampagnes(parcelleId: string): Promise<any[]> {
    const { Campagne } = await import("../campagnes/schemas/campagne.schema");
    const CampagneModel = this.parcelleModel.db.model(Campagne.name);
    return CampagneModel.find({
      parcelleIds: new Types.ObjectId(parcelleId),
    })
      .sort({ dateDebut: -1 })
      .exec();
  }

  async getRecoltes(parcelleId: string): Promise<any[]> {
    const { Recolte } = await import("../recoltes/schemas/recolte.schema");
    const RecolteModel = this.parcelleModel.db.model(Recolte.name);
    return RecolteModel.find({ parcelleId: new Types.ObjectId(parcelleId) })
      .sort({ dateRecolte: -1 })
      .exec();
  }

  async getNdvi(parcelleId: string): Promise<any[]> {
    const { NdviData } = await import("../ndvi/schemas/ndvi.schema");
    const NdviModel = this.parcelleModel.db.model(NdviData.name);
    return NdviModel.find({ parcelleId: new Types.ObjectId(parcelleId) })
      .sort({ date: -1 })
      .exec();
  }

  async createPoi(parcelleId: string, data: any): Promise<any> {
    const { FieldPoi } = await import("./schemas/field-poi.schema");
    const FieldPoiModel = this.parcelleModel.db.model(FieldPoi.name);
    const poi = new FieldPoiModel({
      ...data,
      parcelleId: new Types.ObjectId(parcelleId),
    });
    return poi.save();
  }

  async getPois(parcelleId: string): Promise<any[]> {
    const { FieldPoi } = await import("./schemas/field-poi.schema");
    const FieldPoiModel = this.parcelleModel.db.model(FieldPoi.name);
    return FieldPoiModel.find({
      parcelleId: new Types.ObjectId(parcelleId),
    }).exec();
  }
}
