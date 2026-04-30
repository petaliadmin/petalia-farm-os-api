/**
 * init-db.ts — PostgreSQL + PostGIS initialization
 * Run once after first `docker compose up`:
 *   npx ts-node scripts/init-db.ts
 *
 * What it does:
 *  1. Enable PostGIS + uuid-ossp extensions
 *  2. Create spatial indexes on jsonb geometry columns
 *     (TypeORM @Index handles regular B-tree indexes)
 */

import { AppDataSource } from '../src/database/data-source';

async function initDb() {
  await AppDataSource.initialize();
  const runner = AppDataSource.createQueryRunner();

  try {
    console.log('📦 Enabling PostgreSQL extensions...');
    await runner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await runner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    console.log('  ✅ postgis, uuid-ossp');

    // TypeORM synchronize already creates tables + B-tree indexes.
    // We add PostGIS functional indexes manually on the jsonb centroid/boundary.
    console.log('🗺️  Creating spatial indexes...');

    await runner.query(`
      CREATE INDEX IF NOT EXISTS idx_parcelles_centroid_geo
        ON parcelles
        USING GIST (ST_GeomFromGeoJSON(centroid::text))
        WHERE centroid IS NOT NULL AND deleted = false
    `);
    await runner.query(`
      CREATE INDEX IF NOT EXISTS idx_parcelles_boundary_geo
        ON parcelles
        USING GIST (ST_GeomFromGeoJSON(boundary::text))
        WHERE boundary IS NOT NULL AND deleted = false
    `);
    await runner.query(`
      CREATE INDEX IF NOT EXISTS idx_visites_gps_geo
        ON visites
        USING GIST (ST_GeomFromGeoJSON("gpsLocation"::text))
        WHERE "gpsLocation" IS NOT NULL
    `);
    console.log('  ✅ Spatial indexes created');

    // Partial index for fast unread notifications lookup
    console.log('📋 Creating partial indexes...');
    await runner.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_unread
        ON notifications ("userId", "createdAt" DESC)
        WHERE lue = false
    `);
    await runner.query(`
      CREATE INDEX IF NOT EXISTS idx_parcelles_active
        ON parcelles (code, "organisationId", statut)
        WHERE deleted = false
    `);
    console.log('  ✅ Partial indexes created');

    console.log('\n✅ Database initialization complete');
  } catch (error) {
    console.error('❌ Initialization error:', error);
    process.exit(1);
  } finally {
    await runner.release();
    await AppDataSource.destroy();
  }
}

initDb();
