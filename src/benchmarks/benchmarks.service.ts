import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BenchmarkRendement } from "./entities/benchmark-rendement.entity";
import { Parcelle } from "../parcelles/entities/parcelle.entity";
import { Recolte } from "../recoltes/entities/recolte.entity";
import { ISRA_BENCHMARKS } from "./benchmarks.seed";

@Injectable()
export class BenchmarksService {
  private readonly logger = new Logger(BenchmarksService.name);

  constructor(
    @InjectRepository(BenchmarkRendement)
    private benchRepo: Repository<BenchmarkRendement>,
    @InjectRepository(Parcelle)
    private parcellesRepo: Repository<Parcelle>,
    @InjectRepository(Recolte)
    private recoltesRepo: Repository<Recolte>,
  ) {}

  async findAll(filters: {
    culture?: string;
    zoneAgroecologique?: string;
  }): Promise<BenchmarkRendement[]> {
    const qb = this.benchRepo.createQueryBuilder("b");
    if (filters.culture) {
      qb.andWhere("b.culture = :c", { c: filters.culture });
    }
    if (filters.zoneAgroecologique) {
      qb.andWhere("b.zoneAgroecologique = :z", {
        z: filters.zoneAgroecologique,
      });
    }
    return qb.orderBy("b.culture").addOrderBy("b.zoneAgroecologique").getMany();
  }

  async findOne(id: string): Promise<BenchmarkRendement> {
    const b = await this.benchRepo.findOne({ where: { id } });
    if (!b) throw new NotFoundException(`Benchmark ${id} introuvable`);
    return b;
  }

  async create(data: Partial<BenchmarkRendement>): Promise<BenchmarkRendement> {
    return this.benchRepo.save(this.benchRepo.create(data));
  }

  async update(
    id: string,
    data: Partial<BenchmarkRendement>,
  ): Promise<BenchmarkRendement> {
    await this.findOne(id);
    await this.benchRepo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.benchRepo.delete(id);
  }

  /**
   * Compares observed yield on a parcelle against ISRA reference for its
   * culture × zone × campagne. Returns écart absolu, pourcentage, et classe.
   */
  async compareParcelle(
    parcelleId: string,
    organisationId: string | null,
  ): Promise<{
    parcelleId: string;
    culture: string | null;
    zoneAgroecologique: string | null;
    rendementObserve: number | null;
    benchmark: BenchmarkRendement | null;
    ecartTHa: number | null;
    ecartPct: number | null;
    classe: "sous_performant" | "conforme" | "performant" | null;
  }> {
    const parcelle = await this.parcellesRepo.findOne({
      where: { id: parcelleId, deleted: false },
    });
    if (!parcelle) throw new NotFoundException("Parcelle introuvable");
    if (
      organisationId &&
      parcelle.organisationId &&
      parcelle.organisationId !== organisationId
    ) {
      throw new NotFoundException("Parcelle introuvable");
    }

    const lastRecolte = await this.recoltesRepo.findOne({
      where: { parcelleId, statut: "validee" },
      order: { dateRecolte: "DESC" },
    });

    const benchmark = await this.benchRepo
      .createQueryBuilder("b")
      .where("b.culture = :c", { c: parcelle.culture })
      .andWhere(
        parcelle.zoneAgroecologique
          ? "b.zoneAgroecologique = :z"
          : "b.zoneAgroecologique IS NULL",
        parcelle.zoneAgroecologique ? { z: parcelle.zoneAgroecologique } : {},
      )
      .andWhere(
        parcelle.typeCampagne
          ? "(b.typeCampagne = :tc OR b.typeCampagne IS NULL)"
          : "1=1",
        parcelle.typeCampagne ? { tc: parcelle.typeCampagne } : {},
      )
      .orderBy("CASE WHEN b.typeCampagne IS NOT NULL THEN 0 ELSE 1 END")
      .getOne();

    const rendementObserve = lastRecolte?.rendement ?? null;

    if (!benchmark || rendementObserve == null) {
      return {
        parcelleId,
        culture: parcelle.culture,
        zoneAgroecologique: parcelle.zoneAgroecologique,
        rendementObserve,
        benchmark,
        ecartTHa: null,
        ecartPct: null,
        classe: null,
      };
    }

    const ref = benchmark.rendementMoyenTHa;
    const ecartTHa = Number((rendementObserve - ref).toFixed(2));
    const ecartPct = Number(((ecartTHa / ref) * 100).toFixed(1));
    const classe =
      ecartPct < -15
        ? "sous_performant"
        : ecartPct > 15
          ? "performant"
          : "conforme";

    return {
      parcelleId,
      culture: parcelle.culture,
      zoneAgroecologique: parcelle.zoneAgroecologique,
      rendementObserve,
      benchmark,
      ecartTHa,
      ecartPct,
      classe,
    };
  }

  /**
   * Idempotent seed of ISRA reference benchmarks.
   * Called via `npm run seed:benchmarks`.
   */
  async seed(): Promise<{ inserted: number; skipped: number }> {
    let inserted = 0;
    let skipped = 0;
    for (const row of ISRA_BENCHMARKS) {
      const existing = await this.benchRepo.findOne({
        where: {
          culture: row.culture!,
          zoneAgroecologique: row.zoneAgroecologique ?? null,
          variete: row.variete ?? null,
          typeCampagne: row.typeCampagne ?? null,
        },
      });
      if (existing) {
        skipped++;
        continue;
      }
      await this.benchRepo.save(this.benchRepo.create(row));
      inserted++;
    }
    this.logger.log(`Benchmark seed: ${inserted} inserted, ${skipped} skipped`);
    return { inserted, skipped };
  }
}
