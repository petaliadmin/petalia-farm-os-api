import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recolte } from './entities/recolte.entity';
import { CreateRecolteDto, UpdateRecolteDto } from './dto/recoltes.dto';

@Injectable()
export class RecoltesService {
  constructor(
    @InjectRepository(Recolte)
    private recolteRepo: Repository<Recolte>,
  ) {}

  async create(dto: CreateRecolteDto): Promise<Recolte> {
    return this.recolteRepo.save(this.recolteRepo.create(dto));
  }

  async findAll(query?: {
    parcelleId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Recolte[]; meta: { total: number; page: number; limit: number } }> {
    const page = query?.page || 1;
    const limit = query?.limit || 20;

    const qb = this.recolteRepo
      .createQueryBuilder('r')
      .orderBy('r.dateRecolte', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query?.parcelleId) qb.andWhere('r.parcelleId = :pid', { pid: query.parcelleId });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit } };
  }

  async findById(id: string): Promise<Recolte> {
    const recolte = await this.recolteRepo.findOne({ where: { id } });
    if (!recolte) throw new NotFoundException(`Recolte ${id} non trouvée`);
    return recolte;
  }

  async update(id: string, dto: UpdateRecolteDto): Promise<Recolte> {
    const recolte = await this.findById(id);
    Object.assign(recolte, dto);
    return this.recolteRepo.save(recolte);
  }

  async remove(id: string): Promise<{ data: boolean }> {
    await this.recolteRepo.delete(id);
    return { data: true };
  }

  async findByParcelle(parcelleId: string): Promise<Recolte[]> {
    return this.recolteRepo.find({
      where: { parcelleId },
      order: { dateRecolte: 'DESC' },
    });
  }

  async valider(id: string): Promise<Recolte> {
    const recolte = await this.findById(id);
    recolte.statut = 'validee';
    return this.recolteRepo.save(recolte);
  }
}
