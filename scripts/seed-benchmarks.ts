/**
 * Seed ISRA benchmark yields.
 * Run: npm run seed:benchmarks
 */
import { AppDataSource } from "../src/database/data-source";
import { BenchmarkRendement } from "../src/benchmarks/entities/benchmark-rendement.entity";
import { ISRA_BENCHMARKS } from "../src/benchmarks/benchmarks.seed";

async function main() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(BenchmarkRendement);

  let inserted = 0;
  let skipped = 0;
  for (const row of ISRA_BENCHMARKS) {
    const existing = await repo.findOne({
      where: {
        culture: row.culture!,
        zoneAgroecologique: row.zoneAgroecologique ?? null,
        variete: row.variete ?? null,
        typeCampagne: row.typeCampagne ?? null,
      } as any,
    });
    if (existing) {
      skipped++;
      continue;
    }
    await repo.save(repo.create(row));
    inserted++;
  }

  console.log(`Benchmarks seed: ${inserted} inserted, ${skipped} skipped`);
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
