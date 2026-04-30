import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NdviData } from './entities/ndvi-data.entity';

@Injectable()
export class NdviService {
  constructor(
    @InjectRepository(NdviData)
    private ndviRepo: Repository<NdviData>,
  ) {}

  async getByParcelle(parcelleId: string): Promise<NdviData[]> {
    return this.ndviRepo.find({
      where: { parcelleId },
      order: { date: 'DESC' },
      take: 20,
    });
  }

  async getLatest(parcelleId: string): Promise<NdviData | null> {
    return this.ndviRepo.findOne({
      where: { parcelleId },
      order: { date: 'DESC' },
    });
  }

  async getDashboard(): Promise<{ zone: string; ndviMoyen: number; tendance: string }[]> {
    return [
      { zone: 'Walo', ndviMoyen: 0.72, tendance: 'stable' },
      { zone: 'Ross Béthio', ndviMoyen: 0.65, tendance: 'hausse' },
      { zone: 'Thies', ndviMoyen: 0.58, tendance: 'baisse' },
    ];
  }

  getNdviClasse(ndvi: number): string {
    if (ndvi < 0.3) return 'stress';
    if (ndvi < 0.6) return 'attention';
    return 'sain';
  }

  async fetchNdvi(parcelleId: string): Promise<{ data: { jobId: string } }> {
    const jobId = `ndvi-job-${Date.now()}`;
    return { data: { jobId } };
  }
}
