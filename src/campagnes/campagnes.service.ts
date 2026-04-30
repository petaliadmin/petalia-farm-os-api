import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Campagne } from './entities/campagne.entity';

@Injectable()
export class CampagnesService {
  constructor(
    @InjectRepository(Campagne)
    private campagneRepo: Repository<Campagne>,
    private dataSource: DataSource,
  ) {}

  async create(data: Partial<Campagne>): Promise<Campagne> {
    return this.campagneRepo.save(this.campagneRepo.create(data));
  }

  async findAll(query?: {
    organisationId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Campagne[]; meta: { total: number; page: number; limit: number } }> {
    const page = query?.page || 1;
    const limit = query?.limit || 20;

    const qb = this.campagneRepo
      .createQueryBuilder('c')
      .orderBy('c.dateDebut', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query?.organisationId) qb.andWhere('c.organisationId = :org', { org: query.organisationId });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit } };
  }

  async findById(id: string): Promise<Campagne> {
    const c = await this.campagneRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException(`Campagne ${id} non trouvée`);
    return c;
  }

  async update(id: string, data: Partial<Campagne>): Promise<Campagne> {
    const campagne = await this.findById(id);
    Object.assign(campagne, data);
    return this.campagneRepo.save(campagne);
  }

  async cloture(id: string, data: { dateFin?: string; rendementFinal?: number; observationsCloture?: string }): Promise<Campagne> {
    const campagne = await this.findById(id);
    campagne.statut = 'terminee';
    campagne.progressionPct = 100;
    campagne.dateFin = new Date(data.dateFin || new Date().toISOString().split('T')[0]);
    if (data.rendementFinal) campagne.rendementFinal = data.rendementFinal;
    if (data.observationsCloture) campagne.observationsCloture = data.observationsCloture;
    return this.campagneRepo.save(campagne);
  }

  async activer(id: string): Promise<Campagne> {
    const campagne = await this.findById(id);
    campagne.statut = 'en_cours';
    return this.campagneRepo.save(campagne);
  }

  async remove(id: string): Promise<{ data: boolean }> {
    await this.campagneRepo.delete(id);
    return { data: true };
  }

  async findByParcelle(parcelleId: string): Promise<Campagne[]> {
    return this.campagneRepo
      .createQueryBuilder('c')
      .where(`c."parcelleIds" @> :ids::jsonb`, { ids: JSON.stringify([parcelleId]) })
      .orderBy('c.dateDebut', 'DESC')
      .getMany();
  }

  async getTaches(campagneId: string): Promise<any[]> {
    const { Tache } = await import('../taches/entities/tache.entity');
    return this.dataSource.getRepository(Tache).find({ where: { campagneId } });
  }

  async generateTaches(campagneId: string): Promise<any[]> {
    const { Tache } = await import('../taches/entities/tache.entity');
    const repo = this.dataSource.getRepository(Tache);
    const tasks = [
      repo.create({ titre: 'Inspection parcelles', priorite: 'haute', campagneId }),
      repo.create({ titre: 'Application intrants', priorite: 'normale', campagneId }),
    ];
    return repo.save(tasks);
  }
}
