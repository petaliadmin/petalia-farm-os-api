import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Equipe } from "./entities/equipe.entity";
import { UsersService } from "../users/users.service";

@Injectable()
export class EquipesService {
  constructor(
    @InjectRepository(Equipe)
    private equipeRepo: Repository<Equipe>,
    private usersService: UsersService,
  ) {}

  async findAll(query?: {
    organisationId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Equipe[];
    meta: { total: number; page: number; limit: number };
  }> {
    const page = query?.page || 1;
    const limit = Math.min(query?.limit || 20, 100);
    const where = query?.organisationId
      ? { organisationId: query.organisationId }
      : {};

    const [data, total] = await this.equipeRepo.findAndCount({
      where,
      order: { nom: "ASC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, meta: { total, page, limit } };
  }

  async findById(id: string): Promise<Equipe> {
    const equipe = await this.equipeRepo.findOne({ where: { id } });
    if (!equipe) throw new NotFoundException(`Équipe ${id} non trouvée`);
    return equipe;
  }

  async create(data: Partial<Equipe>): Promise<Equipe> {
    return this.equipeRepo.save(this.equipeRepo.create(data));
  }

  async update(id: string, data: Partial<Equipe>): Promise<Equipe> {
    const equipe = await this.findById(id);
    Object.assign(equipe, data);
    return this.equipeRepo.save(equipe);
  }

  async remove(id: string): Promise<{ data: boolean }> {
    await this.equipeRepo.delete(id);
    return { data: true };
  }

  async getMembres(id: string): Promise<any[]> {
    await this.findById(id);
    return this.usersService.findByEquipage(id);
  }
}
