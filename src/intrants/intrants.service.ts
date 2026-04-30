import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Intrant } from "./entities/intrant.entity";
import { Mouvement } from "./entities/mouvement.entity";
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
    @InjectRepository(Intrant)
    private intrantRepo: Repository<Intrant>,
    @InjectRepository(Mouvement)
    private mouvementRepo: Repository<Mouvement>,
  ) {}

  async create(dto: CreateIntrantDto): Promise<Intrant> {
    return this.intrantRepo.save(this.intrantRepo.create(dto));
  }

  async findAll(query?: {
    organisationId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Intrant[];
    meta: { total: number; page: number; limit: number };
  }> {
    const page = query?.page || 1;
    const limit = query?.limit || 20;

    const qb = this.intrantRepo
      .createQueryBuilder("i")
      .where("i.deleted = false")
      .orderBy("i.nom", "ASC")
      .skip((page - 1) * limit)
      .take(limit);

    if (query?.organisationId)
      qb.andWhere("i.organisationId = :org", { org: query.organisationId });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit } };
  }

  async findById(id: string): Promise<Intrant> {
    const intrant = await this.intrantRepo.findOne({
      where: { id, deleted: false },
    });
    if (!intrant) throw new NotFoundException(`Intrant ${id} non trouvé`);
    return intrant;
  }

  async update(id: string, dto: UpdateIntrantDto): Promise<Intrant> {
    const intrant = await this.findById(id);
    Object.assign(intrant, dto);
    return this.intrantRepo.save(intrant);
  }

  async remove(id: string): Promise<{ data: boolean }> {
    await this.intrantRepo.update(id, { deleted: true });
    return { data: true };
  }

  async createMouvement(id: string, dto: CreateMouvementDto): Promise<Intrant> {
    const intrant = await this.findById(id);

    await this.mouvementRepo.save(
      this.mouvementRepo.create({ ...dto, intrantId: id }),
    );

    if (dto.type === "entree") {
      intrant.quantiteStock += dto.quantite;
    } else {
      if (intrant.quantiteStock < dto.quantite)
        throw new BadRequestException("Stock insuffisant");
      intrant.quantiteStock -= dto.quantite;
    }
    return this.intrantRepo.save(intrant);
  }

  async getMouvements(id: string): Promise<Mouvement[]> {
    return this.mouvementRepo.find({
      where: { intrantId: id },
      order: { date: "DESC" },
    });
  }

  async getStats(organisationId?: string): Promise<IntrantStats> {
    const qb = this.intrantRepo
      .createQueryBuilder("i")
      .where("i.deleted = false");
    if (organisationId)
      qb.andWhere("i.organisationId = :org", { org: organisationId });

    const intrants = await qb.getMany();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    return {
      totalReferences: intrants.length,
      alertesStock: intrants.filter(
        (i) => i.quantiteStock <= (i.seuilAlerte || 0),
      ).length,
      alertesExpiration: intrants.filter(
        (i) => i.dateExpiration && i.dateExpiration <= thirtyDaysFromNow,
      ).length,
      valeurTotale: intrants.reduce(
        (s, i) => s + i.quantiteStock * (i.prixUnitaire || 0),
        0,
      ),
    };
  }

  async getConsommation(): Promise<{ type: string; quantite: number }[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.mouvementRepo
      .createQueryBuilder("m")
      .select("i.type", "type")
      .addSelect("SUM(m.quantite)", "quantite")
      .innerJoin(Intrant, "i", 'i.id = m."intrantId"')
      .where("m.type = 'sortie'")
      .andWhere("m.date >= :since", { since: thirtyDaysAgo })
      .groupBy("i.type")
      .getRawMany<{ type: string; quantite: string }>();

    return result.map((r) => ({
      type: r.type.charAt(0).toUpperCase() + r.type.slice(1),
      quantite: parseFloat(r.quantite),
    }));
  }

  async getAlertes(organisationId?: string): Promise<Intrant[]> {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const qb = this.intrantRepo
      .createQueryBuilder("i")
      .where("i.deleted = false")
      .andWhere(
        '(i."quantiteStock" <= COALESCE(i."seuilAlerte", 0) OR (i."dateExpiration" IS NOT NULL AND i."dateExpiration" <= :limit))',
        { limit: thirtyDaysFromNow },
      );

    if (organisationId)
      qb.andWhere("i.organisationId = :org", { org: organisationId });
    return qb.getMany();
  }
}
