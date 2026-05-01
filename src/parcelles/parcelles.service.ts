import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, DeepPartial, Repository } from "typeorm";
import { Parcelle } from "./entities/parcelle.entity";
import { FieldPoi } from "./entities/field-poi.entity";
import { CreateParcelleDto, UpdateParcelleDto } from "./dto/parcelles.dto";
import { ParcelleStats } from "./interfaces/parcelle.interface";

@Injectable()
export class ParcellesService {
  constructor(
    @InjectRepository(Parcelle)
    private parcelleRepo: Repository<Parcelle>,
    @InjectRepository(FieldPoi)
    private fieldPoiRepo: Repository<FieldPoi>,
    private dataSource: DataSource,
  ) {}

  async create(dto: CreateParcelleDto): Promise<Parcelle> {
    return this.parcelleRepo.save(this.parcelleRepo.create(dto));
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
    const page = query?.page || 1;
    const limit = query?.limit || 20;

    const qb = this.parcelleRepo
      .createQueryBuilder("p")
      .where("p.deleted = false")
      .orderBy("p.code", "ASC")
      .skip((page - 1) * limit)
      .take(limit);

    if (query?.organisationId)
      qb.andWhere("p.organisationId = :org", { org: query.organisationId });
    if (query?.technicienId)
      qb.andWhere("p.technicienId = :tech", { tech: query.technicienId });
    if (query?.statut)
      qb.andWhere("p.statut = :statut", { statut: query.statut });
    if (query?.culture)
      qb.andWhere("p.culture = :culture", { culture: query.culture });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit } };
  }

  async findById(id: string): Promise<Parcelle> {
    const parcelle = await this.parcelleRepo.findOne({
      where: { id, deleted: false },
    });
    if (!parcelle)
      throw new NotFoundException(`Parcelle with ID ${id} not found`);
    return parcelle;
  }

  async update(id: string, dto: UpdateParcelleDto): Promise<Parcelle> {
    const parcelle = await this.findById(id);
    Object.assign(parcelle, dto);
    return this.parcelleRepo.save(parcelle);
  }

  async remove(id: string): Promise<{ data: boolean }> {
    const result = await this.parcelleRepo.update(
      { id, deleted: false },
      { deleted: true },
    );
    if (!result.affected)
      throw new NotFoundException(`Parcelle with ID ${id} not found`);
    return { data: true };
  }

  async findStats(organisationId?: string): Promise<ParcelleStats> {
    const qb = this.parcelleRepo
      .createQueryBuilder("p")
      .where("p.deleted = false");

    if (organisationId)
      qb.andWhere("p.organisationId = :org", { org: organisationId });

    const [total, urgentes, enAttention, sumResult] = await Promise.all([
      qb.getCount(),
      qb.clone().andWhere("p.statut = 'urgent'").getCount(),
      qb.clone().andWhere("p.statut = 'attention'").getCount(),
      qb
        .clone()
        .select("SUM(p.superficie)", "totalHa")
        .getRawOne<{ totalHa: string }>(),
    ]);

    return {
      total,
      urgentes,
      enAttention,
      totalHa: parseFloat(sumResult?.totalHa || "0"),
    };
  }

  async findUrgentes(organisationId?: string): Promise<Parcelle[]> {
    const qb = this.parcelleRepo
      .createQueryBuilder("p")
      .where("p.deleted = false")
      .andWhere("p.statut IN ('urgent', 'attention')")
      .orderBy("p.superficie", "DESC");

    if (organisationId)
      qb.andWhere("p.organisationId = :org", { org: organisationId });
    return qb.getMany();
  }

  async findNearby(
    lat: number,
    lng: number,
    rayon: number,
  ): Promise<Parcelle[]> {
    return this.parcelleRepo
      .createQueryBuilder("p")
      .where("p.deleted = false")
      .andWhere(
        `ST_DWithin(
          ST_GeomFromGeoJSON(p.centroid::text)::geography,
          ST_MakePoint(:lng, :lat)::geography,
          :rayon
        )`,
        { lng, lat, rayon },
      )
      .getMany();
  }

  async findByCode(code: string): Promise<Parcelle | null> {
    return this.parcelleRepo.findOne({ where: { code, deleted: false } });
  }

  async getGeoJSON(): Promise<any> {
    const parcelles = await this.parcelleRepo.find({
      where: { deleted: false },
    });
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
    const { Visite } = await import("../visites/entities/visite.entity");
    return this.dataSource.getRepository(Visite).find({
      where: { parcelleId },
      order: { date: "DESC" },
    });
  }

  async getTaches(parcelleId: string): Promise<any[]> {
    const { Tache } = await import("../taches/entities/tache.entity");
    return this.dataSource.getRepository(Tache).find({ where: { parcelleId } });
  }

  async getCampagnes(parcelleId: string): Promise<any[]> {
    const { Campagne } = await import("../campagnes/entities/campagne.entity");
    return this.dataSource
      .getRepository(Campagne)
      .createQueryBuilder("c")
      .where(`c."parcelleIds" @> :ids::jsonb`, {
        ids: JSON.stringify([parcelleId]),
      })
      .orderBy("c.dateDebut", "DESC")
      .getMany();
  }

  async getRecoltes(parcelleId: string): Promise<any[]> {
    const { Recolte } = await import("../recoltes/entities/recolte.entity");
    return this.dataSource.getRepository(Recolte).find({
      where: { parcelleId },
      order: { dateRecolte: "DESC" },
    });
  }

  async getNdvi(parcelleId: string): Promise<any[]> {
    const { NdviData } = await import("../ndvi/entities/ndvi-data.entity");
    return this.dataSource.getRepository(NdviData).find({
      where: { parcelleId },
      order: { date: "DESC" },
      take: 20,
    });
  }

  async createPoi(parcelleId: string, data: any): Promise<FieldPoi> {
    return this.fieldPoiRepo.save(
      this.fieldPoiRepo.create({ ...data, parcelleId } as DeepPartial<FieldPoi>),
    );
  }

  async getPois(parcelleId: string): Promise<FieldPoi[]> {
    return this.fieldPoiRepo.find({ where: { parcelleId } });
  }
}
