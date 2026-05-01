import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Organisation } from "./entities/organisation.entity";
import {
  CreateOrganisationDto,
  UpdateOrganisationDto,
} from "./dto/organisations.dto";

@Injectable()
export class OrganisationsService {
  constructor(
    @InjectRepository(Organisation)
    private orgRepo: Repository<Organisation>,
  ) {}

  async create(dto: CreateOrganisationDto): Promise<Organisation> {
    if (dto.email) {
      const exists = await this.orgRepo.findOne({
        where: { email: dto.email },
      });
      if (exists) {
        throw new ConflictException(
          "Une organisation avec cet email existe déjà",
        );
      }
    }
    return this.orgRepo.save(this.orgRepo.create(dto));
  }

  async findAll(pays?: string): Promise<Organisation[]> {
    const where: any = { actif: true };
    if (pays) where.pays = pays;
    return this.orgRepo.find({ where, order: { nom: "ASC" } });
  }

  async findById(id: string): Promise<Organisation> {
    const org = await this.orgRepo.findOne({ where: { id } });
    if (!org) throw new NotFoundException(`Organisation ${id} introuvable`);
    return org;
  }

  async update(id: string, dto: UpdateOrganisationDto): Promise<Organisation> {
    const org = await this.findById(id);
    Object.assign(org, dto);
    return this.orgRepo.save(org);
  }

  async getDashboard(id: string) {
    const org = await this.findById(id);
    // TODO Sprint 2: Aggregate real stats from parcelles, recoltes, users
    return {
      organisation: { id: org.id, nom: org.nom, plan: org.subscriptionPlan },
      stats: {
        total_parcelles: 0,
        total_utilisateurs: 0,
        total_campagnes: 0,
        surface_totale_ha: 0,
      },
    };
  }

  async deactivate(id: string): Promise<void> {
    const org = await this.findById(id);
    org.actif = false;
    await this.orgRepo.save(org);
  }
}
