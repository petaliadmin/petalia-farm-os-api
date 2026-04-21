import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Intrant, IntrantDocument } from "./schemas/intrant.schema";
import { Mouvement, MouvementDocument } from "./schemas/mouvement.schema";
import {
  CreateIntrantDto,
  UpdateIntrantDto,
  CreateMouvementDto,
} from "./dto/intrants.dto";

export interface IntrantStats {
  totalReferences: number;
  alertesStock: number;
  alertesExpiration: number;
  valeurTotale: number;
}

@Injectable()
export class IntrantsService {
  constructor(
    @InjectModel(Intrant.name) private intrantModel: Model<IntrantDocument>,
    @InjectModel(Mouvement.name)
    private mouvementModel: Model<MouvementDocument>,
  ) {}

  async create(createDto: CreateIntrantDto): Promise<Intrant> {
    const created = new this.intrantModel(createDto);
    return created.save();
  }

  async findAll(query?: {
    organisationId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Intrant[];
    meta: { total: number; page: number; limit: number };
  }> {
    const filter: any = { deleted: false };
    if (query?.organisationId) {
      filter.organisationId = new Types.ObjectId(query.organisationId);
    }

    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.intrantModel
        .find(filter)
        .sort({ nom: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.intrantModel.countDocuments(filter),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findById(id: string): Promise<Intrant> {
    const intrant = await this.intrantModel.findById(id).exec();
    if (!intrant) throw new NotFoundException(`Intrant ${id} non trouvé`);
    return intrant;
  }

  async update(id: string, updateDto: UpdateIntrantDto): Promise<Intrant> {
    const updated = await this.intrantModel
      .findByIdAndUpdate(id, updateDto, { new: true })
      .exec();
    if (!updated) throw new NotFoundException(`Intrant ${id} non trouvé`);
    return updated;
  }

  async remove(id: string): Promise<{ data: boolean }> {
    await this.intrantModel.findByIdAndUpdate(id, { deleted: true }).exec();
    return { data: true };
  }

  async createMouvement(
    id: string,
    createDto: CreateMouvementDto,
  ): Promise<Intrant> {
    const intrant = await this.intrantModel.findById(id).exec();
    if (!intrant) throw new NotFoundException(`Intrant ${id} non trouvé`);

    const mouvement = new this.mouvementModel({
      ...createDto,
      intrantId: new Types.ObjectId(id),
    });
    await mouvement.save();

    // Recalculate stock
    if (createDto.type === "entree") {
      intrant.quantiteStock += createDto.quantite;
    } else {
      if (intrant.quantiteStock < createDto.quantite) {
        throw new BadRequestException("Stock insuffisant");
      }
      intrant.quantiteStock -= createDto.quantite;
    }
    await intrant.save();

    return intrant;
  }

  async getMouvements(id: string): Promise<Mouvement[]> {
    return this.mouvementModel
      .find({ intrantId: new Types.ObjectId(id) })
      .sort({ date: -1 })
      .exec();
  }

  async getStats(organisationId?: string): Promise<IntrantStats> {
    const filter: any = { deleted: false };
    if (organisationId) {
      filter.organisationId = new Types.ObjectId(organisationId);
    }

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const intrants = await this.intrantModel.find(filter).exec();
    const totalReferences = intrants.length;
    const alertesStock = intrants.filter(
      (i) => i.quantiteStock <= (i.seuilAlerte || 0),
    ).length;
    const alertesExpiration = intrants.filter(
      (i) => i.dateExpiration && i.dateExpiration <= thirtyDaysFromNow,
    ).length;
    const valeurTotale = intrants.reduce(
      (sum, i) => sum + i.quantiteStock * i.prixUnitaire,
      0,
    );

    return { totalReferences, alertesStock, alertesExpiration, valeurTotale };
  }

  async getConsommation(): Promise<{ type: string; quantite: number }[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.mouvementModel.aggregate([
      { $match: { type: "sortie", date: { $gte: thirtyDaysAgo } } },
      {
        $lookup: {
          from: "intrants",
          localField: "intrantId",
          foreignField: "_id",
          as: "intrant",
        },
      },
      { $unwind: "$intrant" },
      {
        $group: {
          _id: "$intrant.type",
          quantite: { $sum: "$quantite" },
        },
      },
    ]);

    return result.map((r) => ({
      type: r._id.charAt(0).toUpperCase() + r._id.slice(1),
      quantite: r.quantite,
    }));
  }

  async getAlertes(): Promise<Intrant[]> {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    return this.intrantModel
      .find({
        deleted: false,
        $or: [
          { quantiteStock: { $lte: { $ifNull: ["$seuilAlerte", 0] } } },
          { dateExpiration: { $lte: thirtyDaysFromNow } },
        ],
      })
      .exec();
  }
}
