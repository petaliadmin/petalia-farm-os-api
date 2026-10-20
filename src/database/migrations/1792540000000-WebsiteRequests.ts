import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Demandes du site vitrine petalia.sn (contact, démo, commande boutique).
 * Nouvelle table uniquement : aucun verrou sur les tables existantes.
 */
export class WebsiteRequests1792540000000 implements MigrationInterface {
  name = "WebsiteRequests1792540000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "website_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" character varying(16) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'new', "name" character varying(120) NOT NULL, "phone" character varying(20) NOT NULL, "email" character varying(254), "message" text, "details" jsonb NOT NULL DEFAULT '{}', "lines" jsonb, "totalFcfa" integer, "notes" text, "sourcePage" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_72136493f432a6123cbb7164278" PRIMARY KEY ("id"), CONSTRAINT "CHK_d70aa4e6cdb732ed3ddbde0972" CHECK ("type" IN ('contact', 'demo', 'order')), CONSTRAINT "CHK_e1bf70aaff1172e64de0ac9d5d" CHECK ("status" IN ('new', 'in_progress', 'done', 'spam')))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1a524f028a9a23a8acaf0bac91" ON "website_requests" ("type", "status", "createdAt") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1a524f028a9a23a8acaf0bac91"`,
    );
    await queryRunner.query(`DROP TABLE "website_requests"`);
  }
}
