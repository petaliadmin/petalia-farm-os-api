import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Public API foundation (/api/v1) — generated from the entities, then reviewed.
 *
 *   - New tables: farmers, farms, crop_cycles, devices, observations,
 *     consents, data_access_logs, api_events, webhook_endpoints,
 *     channel_notifications, api_jobs, idempotency_keys.
 *   - api_keys: mode (live|test) and kind (secret|publishable); existing keys
 *     default to live/secret, so current partners keep working unchanged.
 *   - parcelles: farmerId, farmId, livemode, metadata. ADD COLUMN with a
 *     constant default is metadata-only on Postgres ≥ 11 (no table rewrite).
 *     The farmerId index is built on an all-NULL column: short write lock.
 */
export class PublicApiFoundation1792435700310 implements MigrationInterface {
  name = "PublicApiFoundation1792435700310";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "webhook_endpoints" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "livemode" boolean NOT NULL DEFAULT true, "organisationId" uuid NOT NULL, "url" character varying(2048) NOT NULL, "description" character varying(255), "enabledEvents" jsonb NOT NULL DEFAULT '["*"]', "secret" character varying NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'enabled', "apiVersion" character varying(10) NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_054c4cfb95223732f5939d2d546" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_273626863ebb949a53387eb473" ON "webhook_endpoints" ("organisationId", "livemode", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "idempotency_keys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "apiKeyId" uuid NOT NULL, "key" character varying(255) NOT NULL, "fingerprint" character varying(64) NOT NULL, "status" character varying(16) NOT NULL, "responseStatus" integer, "responseBody" jsonb, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8ad20779ad0411107a56e53d0f6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_69cdd42dc83e6208402de6acef" ON "idempotency_keys" ("expiresAt") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4a99315c8a64bae33d976cc519" ON "idempotency_keys" ("apiKeyId", "key") `,
    );
    await queryRunner.query(
      `CREATE TABLE "observations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "livemode" boolean NOT NULL DEFAULT true, "organisationId" uuid NOT NULL, "parcelleId" uuid, "deviceId" uuid, "sourceType" character varying(16) NOT NULL, "property" character varying(48) NOT NULL, "value" double precision NOT NULL, "unit" character varying(16) NOT NULL, "observedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "quality" character varying(16) NOT NULL DEFAULT 'raw', "location" jsonb, "metadata" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f9208d64f50a76030758087c0ef" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_8acac70759fe7e75d27205efa4" ON "observations" ("deviceId", "property", "observedAt") WHERE "deviceId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_00b4564ec5a572f30a6efc21db" ON "observations" ("organisationId", "livemode", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c9e74127a78ad44bd809f4ac62" ON "observations" ("parcelleId", "property", "observedAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "farms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "livemode" boolean NOT NULL DEFAULT true, "organisationId" uuid, "farmerId" uuid NOT NULL, "name" character varying(120) NOT NULL, "locality" character varying(120), "region" character varying(80), "location" jsonb, "metadata" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_39aff9c35006b14025bba5a43d9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1da24dfde704fa3abf87f094f9" ON "farms" ("organisationId", "livemode", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_580fc6f3650c22a430809b4fef" ON "farms" ("farmerId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "farmers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "livemode" boolean NOT NULL DEFAULT true, "organisationId" uuid, "phone" character varying(20) NOT NULL, "firstName" character varying(80) NOT NULL, "lastName" character varying(80) NOT NULL, "gender" character varying(8), "birthYear" integer, "preferredLanguage" character varying(8) NOT NULL DEFAULT 'fr', "preferredChannel" character varying(16) NOT NULL DEFAULT 'sms', "locality" character varying(120), "region" character varying(80), "country" character varying(2) NOT NULL DEFAULT 'SN', "metadata" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_ccbe91e5e64dde1329b4c153637" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_df3af3775d55c19c41db902ec9" ON "farmers" ("organisationId", "livemode", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_948eb6c5d543f5f441ea687d5a" ON "farmers" ("phone", "livemode") `,
    );
    await queryRunner.query(
      `CREATE TABLE "data_access_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "livemode" boolean NOT NULL DEFAULT true, "farmerId" uuid NOT NULL, "organisationId" uuid NOT NULL, "apiKeyId" uuid, "action" character varying(8) NOT NULL, "resourceType" character varying(32) NOT NULL, "resourceId" uuid, "basis" character varying(16) NOT NULL, "consentId" uuid, "requestId" character varying(64), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_887a3d112356cce5f7e918d9a09" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5a49180ba4e43af3300fa2c3a1" ON "data_access_logs" ("farmerId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "crop_cycles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "livemode" boolean NOT NULL DEFAULT true, "organisationId" uuid, "parcelleId" uuid NOT NULL, "crop" character varying(40) NOT NULL, "variety" character varying(80), "season" character varying(16) NOT NULL, "campaignYear" integer NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'planned', "sownOn" date, "expectedHarvestOn" date, "harvestedOn" date, "yieldKg" double precision, "metadata" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ae97e5ce813d95a8a6746251542" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cd840e9174a4b1bc92122f7ffe" ON "crop_cycles" ("organisationId", "livemode", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7a7de84ed246477bdf1f467555" ON "crop_cycles" ("parcelleId", "campaignYear") `,
    );
    await queryRunner.query(
      `CREATE TABLE "devices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "livemode" boolean NOT NULL DEFAULT true, "organisationId" uuid NOT NULL, "parcelleId" uuid, "type" character varying(24) NOT NULL, "manufacturer" character varying(40) NOT NULL, "model" character varying(60), "serialNumber" character varying(80), "devEui" character varying(16), "name" character varying(120) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'active', "lastSeenAt" TIMESTAMP WITH TIME ZONE, "location" jsonb, "metadata" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_b1514758245c12daf43486dd1f0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f0f3068d4e7cfdf72267cca855" ON "devices" ("parcelleId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ca331b1e79f38954db8e7f1cb9" ON "devices" ("organisationId", "livemode", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a992040305626a94ef1304da07" ON "devices" ("devEui", "livemode") WHERE "devEui" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "consents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "livemode" boolean NOT NULL DEFAULT true, "farmerId" uuid NOT NULL, "granteeOrganisationId" uuid NOT NULL, "requestedByApiKeyId" uuid, "scopes" jsonb NOT NULL DEFAULT '[]', "purpose" text NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'pending', "method" character varying(16) NOT NULL DEFAULT 'sms_otp', "otpHash" character varying, "otpExpiresAt" TIMESTAMP WITH TIME ZONE, "otpAttempts" integer NOT NULL DEFAULT '0', "grantedAt" TIMESTAMP WITH TIME ZONE, "revokedAt" TIMESTAMP WITH TIME ZONE, "expiresAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9efc68eb6aba7d638fb6ea034dd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dda4f2f49b674076c75b889821" ON "consents" ("granteeOrganisationId", "livemode", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_da5f1fc6db5af6ff1974cf0ed3" ON "consents" ("farmerId", "granteeOrganisationId", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "channel_notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "livemode" boolean NOT NULL DEFAULT true, "organisationId" uuid NOT NULL, "farmerId" uuid, "toPhone" character varying(20) NOT NULL, "channel" character varying(16) NOT NULL, "body" text NOT NULL, "language" character varying(8) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'queued', "failureReason" character varying(255), "providerReference" character varying(255), "metadata" jsonb NOT NULL DEFAULT '{}', "sentAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7621370292c2c474490ed54b4a2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9dbb49d4b6b10db74f9a1a9a98" ON "channel_notifications" ("farmerId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_debd1dc196dec7332dd6cb42f0" ON "channel_notifications" ("organisationId", "livemode", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "api_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "livemode" boolean NOT NULL DEFAULT true, "organisationId" uuid NOT NULL, "type" character varying(48) NOT NULL, "data" jsonb NOT NULL, "apiVersion" character varying(10) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e3826ce4ae3f91c05bd37bb1502" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_63d95bba5c400fc8542c9d874e" ON "api_events" ("organisationId", "livemode", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "api_jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "livemode" boolean NOT NULL DEFAULT true, "organisationId" uuid NOT NULL, "type" character varying(32) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'queued', "parcelleId" uuid, "queueJobId" character varying(128), "result" jsonb, "error" jsonb, "completedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_feedadc50ee4a2c51615a398c63" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_246f3d471e8744f79b92cb12fc" ON "api_jobs" ("queueJobId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_322acfd92632326d91f2658bc2" ON "api_jobs" ("organisationId", "livemode", "createdAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" ADD "mode" character varying(8) NOT NULL DEFAULT 'live'`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" ADD "kind" character varying(16) NOT NULL DEFAULT 'secret'`,
    );
    await queryRunner.query(`ALTER TABLE "parcelles" ADD "farmerId" uuid`);
    await queryRunner.query(`ALTER TABLE "parcelles" ADD "farmId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "parcelles" ADD "livemode" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "parcelles" ADD "metadata" jsonb NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d3e273c2d23098008f859aae30" ON "parcelles" ("farmerId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d3e273c2d23098008f859aae30"`,
    );
    await queryRunner.query(`ALTER TABLE "parcelles" DROP COLUMN "metadata"`);
    await queryRunner.query(`ALTER TABLE "parcelles" DROP COLUMN "livemode"`);
    await queryRunner.query(`ALTER TABLE "parcelles" DROP COLUMN "farmId"`);
    await queryRunner.query(`ALTER TABLE "parcelles" DROP COLUMN "farmerId"`);
    await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN "kind"`);
    await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN "mode"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_322acfd92632326d91f2658bc2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_246f3d471e8744f79b92cb12fc"`,
    );
    await queryRunner.query(`DROP TABLE "api_jobs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_63d95bba5c400fc8542c9d874e"`,
    );
    await queryRunner.query(`DROP TABLE "api_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_debd1dc196dec7332dd6cb42f0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9dbb49d4b6b10db74f9a1a9a98"`,
    );
    await queryRunner.query(`DROP TABLE "channel_notifications"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_da5f1fc6db5af6ff1974cf0ed3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dda4f2f49b674076c75b889821"`,
    );
    await queryRunner.query(`DROP TABLE "consents"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a992040305626a94ef1304da07"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ca331b1e79f38954db8e7f1cb9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f0f3068d4e7cfdf72267cca855"`,
    );
    await queryRunner.query(`DROP TABLE "devices"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7a7de84ed246477bdf1f467555"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cd840e9174a4b1bc92122f7ffe"`,
    );
    await queryRunner.query(`DROP TABLE "crop_cycles"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5a49180ba4e43af3300fa2c3a1"`,
    );
    await queryRunner.query(`DROP TABLE "data_access_logs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_948eb6c5d543f5f441ea687d5a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_df3af3775d55c19c41db902ec9"`,
    );
    await queryRunner.query(`DROP TABLE "farmers"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_580fc6f3650c22a430809b4fef"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1da24dfde704fa3abf87f094f9"`,
    );
    await queryRunner.query(`DROP TABLE "farms"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c9e74127a78ad44bd809f4ac62"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_00b4564ec5a572f30a6efc21db"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8acac70759fe7e75d27205efa4"`,
    );
    await queryRunner.query(`DROP TABLE "observations"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4a99315c8a64bae33d976cc519"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_69cdd42dc83e6208402de6acef"`,
    );
    await queryRunner.query(`DROP TABLE "idempotency_keys"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_273626863ebb949a53387eb473"`,
    );
    await queryRunner.query(`DROP TABLE "webhook_endpoints"`);
  }
}
