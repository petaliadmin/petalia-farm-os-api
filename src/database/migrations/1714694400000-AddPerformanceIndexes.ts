import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Sprint 6.5 — Performance indexes for hot read paths.
 *
 * Targets identified by audit.md §6.5 plus concrete bottlenecks observed:
 *   - Visite/recolte timelines: ORDER BY date DESC dominates analytics
 *   - Notifications inbox: filtered by (userId, lue=false)
 *   - Taches Kanban: filtered by (assigneAId) with statut != done
 *   - NDVI lookups: latest sample per parcelle
 *   - Audit log: already indexed via entity decorators (no-op here)
 *   - Multi-tenant scope: organisationId filter on every list endpoint
 *
 * All indexes use IF NOT EXISTS so reruns are safe.
 */
export class AddPerformanceIndexes1714694400000 implements MigrationInterface {
  name = "AddPerformanceIndexes1714694400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const statements = [
      // Visites — recent activity feeds and analytics
      `CREATE INDEX IF NOT EXISTS "idx_visites_date" ON "visites" ("date" DESC)`,
      `CREATE INDEX IF NOT EXISTS "idx_visites_org_date" ON "visites" ("organisationId", "date" DESC)`,
      `CREATE INDEX IF NOT EXISTS "idx_visites_parcelle_date" ON "visites" ("parcelleId", "date" DESC)`,

      // Recoltes — yield trends, campaign closing
      `CREATE INDEX IF NOT EXISTS "idx_recoltes_date" ON "recoltes" ("dateRecolte" DESC)`,
      `CREATE INDEX IF NOT EXISTS "idx_recoltes_org_date" ON "recoltes" ("organisationId", "dateRecolte" DESC)`,
      `CREATE INDEX IF NOT EXISTS "idx_recoltes_parcelle" ON "recoltes" ("parcelleId")`,

      // Notifications — unread inbox is the common query
      `CREATE INDEX IF NOT EXISTS "idx_notifications_user_unread" ON "notifications" ("userId", "createdAt" DESC) WHERE "lue" = false`,
      `CREATE INDEX IF NOT EXISTS "idx_notifications_user_created" ON "notifications" ("userId", "createdAt" DESC)`,

      // Taches — Kanban board (open tasks per assignee)
      `CREATE INDEX IF NOT EXISTS "idx_taches_assignee_open" ON "taches" ("assigneAId", "statut") WHERE "statut" != 'done'`,
      `CREATE INDEX IF NOT EXISTS "idx_taches_org_status" ON "taches" ("organisationId", "statut")`,

      // NDVI — most recent sample per parcelle
      `CREATE INDEX IF NOT EXISTS "idx_ndvi_parcelle_date" ON "ndvi_data" ("parcelleId", "date" DESC)`,

      // Parcelles — common filter "non-deleted parcelles in org"
      `CREATE INDEX IF NOT EXISTS "idx_parcelles_org_active" ON "parcelles" ("organisationId") WHERE "deleted" = false`,

      // Tenant scope — generic
      `CREATE INDEX IF NOT EXISTS "idx_campagnes_org" ON "campagnes" ("organisationId")`,
      `CREATE INDEX IF NOT EXISTS "idx_intrants_org" ON "intrants" ("organisationId")`,
    ];

    for (const sql of statements) {
      await queryRunner.query(sql);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const indexes = [
      "idx_visites_date",
      "idx_visites_org_date",
      "idx_visites_parcelle_date",
      "idx_recoltes_date",
      "idx_recoltes_org_date",
      "idx_recoltes_parcelle",
      "idx_notifications_user_unread",
      "idx_notifications_user_created",
      "idx_taches_assignee_open",
      "idx_taches_org_status",
      "idx_ndvi_parcelle_date",
      "idx_parcelles_org_active",
      "idx_campagnes_org",
      "idx_intrants_org",
    ];

    for (const name of indexes) {
      await queryRunner.query(`DROP INDEX IF EXISTS "${name}"`);
    }
  }
}
