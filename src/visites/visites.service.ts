import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Visite } from './entities/visite.entity';
import { CreateVisiteDto, UpdateVisiteDto } from './dto/visites.dto';

export interface VisiteStats {
  total: number;
  completees: number;
  planifiees: number;
  enCours: number;
}

@Injectable()
export class VisitesService {
  constructor(
    @InjectRepository(Visite)
    private visiteRepo: Repository<Visite>,
  ) {}

  async create(dto: CreateVisiteDto): Promise<Visite> {
    return this.visiteRepo.save(this.visiteRepo.create(dto));
  }

  async findAll(query?: {
    organisationId?: string;
    technicianId?: string;
    statut?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Visite[]; meta: { total: number; page: number; limit: number } }> {
    const page = query?.page || 1;
    const limit = query?.limit || 20;

    const qb = this.visiteRepo
      .createQueryBuilder('v')
      .orderBy('v.date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query?.organisationId) qb.andWhere('v.organisationId = :org', { org: query.organisationId });
    if (query?.technicianId) qb.andWhere('v.technicienId = :tech', { tech: query.technicianId });
    if (query?.statut) qb.andWhere('v.statut = :statut', { statut: query.statut });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit } };
  }

  async findById(id: string): Promise<Visite> {
    const visite = await this.visiteRepo.findOne({ where: { id } });
    if (!visite) throw new NotFoundException(`Visite with ID ${id} not found`);
    return visite;
  }

  async update(id: string, dto: UpdateVisiteDto): Promise<Visite> {
    const visite = await this.findById(id);
    Object.assign(visite, dto);
    return this.visiteRepo.save(visite);
  }

  async remove(id: string): Promise<{ data: boolean }> {
    const result = await this.visiteRepo.delete(id);
    if (!result.affected) throw new NotFoundException(`Visite with ID ${id} not found`);
    return { data: true };
  }

  async findRecentes(limit: number = 5): Promise<Visite[]> {
    return this.visiteRepo
      .createQueryBuilder('v')
      .where("v.statut != 'annulee'")
      .orderBy('v.date', 'DESC')
      .take(limit)
      .getMany();
  }

  async findStats(organisationId?: string): Promise<VisiteStats> {
    const base = this.visiteRepo.createQueryBuilder('v');
    if (organisationId) base.where('v.organisationId = :org', { org: organisationId });

    const [total, completees, planifiees, enCours] = await Promise.all([
      base.clone().getCount(),
      base.clone().andWhere("v.statut = 'completee'").getCount(),
      base.clone().andWhere("v.statut = 'planifiee'").getCount(),
      base.clone().andWhere("v.statut = 'en_cours'").getCount(),
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

    const visites = await this.visiteRepo
      .createQueryBuilder('v')
      .where('v.date BETWEEN :start AND :end', { start: startOfWeek, end: endOfWeek })
      .andWhere("v.statut != 'annulee'")
      .getMany();

    const jours = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const counts = jours.map((jour) => ({ jour, count: 0 }));
    visites.forEach((v) => {
      const idx = new Date(v.date).getDay() - 1;
      counts[idx < 0 ? 6 : idx].count++;
    });
    return counts;
  }

  async findByParcelle(parcelleId: string): Promise<Visite[]> {
    return this.visiteRepo.find({
      where: { parcelleId },
      order: { date: 'DESC' },
    });
  }

  async uploadPhotos(id: string, photos: string[]): Promise<{ data: { photos: string[] } }> {
    const visite = await this.findById(id);
    visite.photos = [...(visite.photos || []), ...photos];
    await this.visiteRepo.save(visite);
    return { data: { photos: visite.photos } };
  }

  async getRapport(id: string): Promise<{ data: { url: string; nom: string } }> {
    const visite = await this.findById(id);
    if (visite.rapport) {
      return { data: { url: visite.rapport, nom: `Rapport_${id}.pdf` } };
    }
    return this.generateRapport(id);
  }

  async generateRapport(id: string): Promise<{ data: { url: string; nom: string } }> {
    const url = `https://cdn.cloudinary.com/petalia/rapports/Rapport_${id}.pdf`;
    await this.visiteRepo.update(id, { rapport: url });
    return { data: { url, nom: `Rapport_${id}.pdf` } };
  }
}
