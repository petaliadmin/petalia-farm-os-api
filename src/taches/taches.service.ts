import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Tache } from "./entities/tache.entity";
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
    @InjectRepository(Tache)
    private tacheRepo: Repository<Tache>,
  ) {}

  async create(dto: CreateTacheDto): Promise<Tache> {
    return this.tacheRepo.save(this.tacheRepo.create(dto));
  }

  async findAll(query?: {
    statut?: string;
    assigneeId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Tache[];
    meta: { total: number; page: number; limit: number };
  }> {
    const page = query?.page || 1;
    const limit = query?.limit || 20;

    const qb = this.tacheRepo
      .createQueryBuilder("t")
      .orderBy("t.priorite", "DESC")
      .addOrderBy("t.datePlanifiee", "ASC")
      .skip((page - 1) * limit)
      .take(limit);

    if (query?.statut)
      qb.andWhere("t.statut = :statut", { statut: query.statut });
    if (query?.assigneeId)
      qb.andWhere("t.assigneAId = :aid", { aid: query.assigneeId });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit } };
  }

  async findById(id: string): Promise<Tache> {
    const tache = await this.tacheRepo.findOne({ where: { id } });
    if (!tache) throw new NotFoundException(`Tache ${id} non trouvée`);
    return tache;
  }

  async update(id: string, dto: UpdateTacheDto): Promise<Tache> {
    const tache = await this.findById(id);
    Object.assign(tache, dto);
    return this.tacheRepo.save(tache);
  }

  async updateStatut(id: string, statut: string): Promise<Tache> {
    const tache = await this.findById(id);
    tache.statut = statut;
    if (statut === "done") tache.dateTerminee = new Date();
    return this.tacheRepo.save(tache);
  }

  async remove(id: string): Promise<{ data: boolean }> {
    const result = await this.tacheRepo.delete(id);
    if (!result.affected)
      throw new NotFoundException(`Tache ${id} non trouvée`);
    return { data: true };
  }

  async getStats(): Promise<TacheStats> {
    const base = this.tacheRepo.createQueryBuilder("t");
    const [total, urgentes, enCours, terminees] = await Promise.all([
      base.clone().getCount(),
      base.clone().andWhere("t.priorite = 'urgente'").getCount(),
      base.clone().andWhere("t.statut = 'en_cours'").getCount(),
      base.clone().andWhere("t.statut = 'done'").getCount(),
    ]);
    return { total, urgentes, enCours, terminees };
  }

  async findUrgentes(): Promise<Tache[]> {
    return this.tacheRepo
      .createQueryBuilder("t")
      .where("t.priorite = 'urgente'")
      .andWhere("t.statut != 'done'")
      .getMany();
  }

  async getKanban(): Promise<{
    todo: Tache[];
    en_cours: Tache[];
    done: Tache[];
    reporte: Tache[];
  }> {
    const [todo, en_cours, done, reporte] = await Promise.all([
      this.tacheRepo.find({
        where: { statut: "todo" },
        order: { priorite: "DESC", datePlanifiee: "ASC" },
        take: 20,
      }),
      this.tacheRepo.find({
        where: { statut: "en_cours" },
        order: { datePlanifiee: "ASC" },
        take: 20,
      }),
      this.tacheRepo.find({
        where: { statut: "done" },
        order: { dateTerminee: "DESC" },
        take: 20,
      }),
      this.tacheRepo.find({
        where: { statut: "reporte" },
        order: { datePlanifiee: "ASC" },
        take: 20,
      }),
    ]);
    return { todo, en_cours, done, reporte };
  }
}
