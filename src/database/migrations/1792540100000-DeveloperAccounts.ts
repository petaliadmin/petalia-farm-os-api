import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Comptes de l'espace développeur en libre-service (developers.petalia.sn).
 * Nouvelle table uniquement : aucun verrou sur les tables existantes.
 */
export class DeveloperAccounts1792540100000 implements MigrationInterface {
  name = "DeveloperAccounts1792540100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "developer_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(254) NOT NULL, "passwordHash" character varying NOT NULL, "name" character varying(120) NOT NULL, "company" character varying(120), "phone" character varying(20) NOT NULL, "organisationId" uuid, "verifiedAt" TIMESTAMP WITH TIME ZONE, "otpHash" character varying, "otpExpiresAt" TIMESTAMP WITH TIME ZONE, "otpSentAt" TIMESTAMP WITH TIME ZONE, "otpAttempts" integer NOT NULL DEFAULT '0', "failedLogins" integer NOT NULL DEFAULT '0', "lockedUntil" TIMESTAMP WITH TIME ZONE, "lastLoginAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2b5f760aca9034b948d905112ac" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ad883f5e18f84a6c7f9e41728f" ON "developer_accounts" ("email") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ad883f5e18f84a6c7f9e41728f"`,
    );
    await queryRunner.query(`DROP TABLE "developer_accounts"`);
  }
}
