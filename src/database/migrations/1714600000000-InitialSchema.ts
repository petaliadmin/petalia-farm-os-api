import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Baseline schema — every table that existed before the public API, generated
 * from the entities against an empty PostGIS database.
 *
 * Until now the schema was created by TypeORM `synchronize`. A database built
 * that way (the current AWS instance) already has these tables: the migration
 * detects it and only records itself, so `migration:run` stays safe there.
 * A fresh database (Supabase) gets the full schema.
 */
export class InitialSchema1714600000000 implements MigrationInterface {
  name = "InitialSchema1714600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    if (await queryRunner.hasTable("users")) return;

    await queryRunner.query(
      `CREATE TABLE "whatsapp_optins" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "phoneE164" character varying NOT NULL, "optedIn" boolean NOT NULL DEFAULT true, "topics" jsonb NOT NULL DEFAULT '["alerte","avertissement"]', "language" character varying NOT NULL DEFAULT 'fr', "optedInAt" TIMESTAMP, "optedOutAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "uq_optin_user" UNIQUE ("userId"), CONSTRAINT "PK_afa81fab6e7662720843f51ea4e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b5e28b74a59c2dedf05210bb53" ON "whatsapp_optins" ("phoneE164") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."whatsapp_messages_direction_enum" AS ENUM('outbound', 'inbound')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."whatsapp_messages_status_enum" AS ENUM('queued', 'sent', 'delivered', 'read', 'failed', 'received')`,
    );
    await queryRunner.query(
      `CREATE TABLE "whatsapp_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying, "toPhoneE164" character varying NOT NULL, "direction" "public"."whatsapp_messages_direction_enum" NOT NULL DEFAULT 'outbound', "status" "public"."whatsapp_messages_status_enum" NOT NULL DEFAULT 'queued', "templateName" character varying, "language" character varying NOT NULL DEFAULT 'fr', "bodyText" text, "variables" jsonb, "waMessageId" character varying, "notificationId" character varying, "errorMessage" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_807bc612c6b98de7645a99805ca" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_430e0d8da5c37725bc0ea6dfb9" ON "whatsapp_messages" ("waMessageId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_260ef9f2c53f5539a72afb5695" ON "whatsapp_messages" ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."webhooks_evenement_enum" AS ENUM('recolte.created', 'recolte.validated', 'visite.completed', 'parcelle.created', 'ndvi.alerte', 'campagne.terminee')`,
    );
    await queryRunner.query(
      `CREATE TABLE "webhooks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nom" character varying NOT NULL, "url" character varying NOT NULL, "evenement" "public"."webhooks_evenement_enum" NOT NULL, "actif" boolean NOT NULL DEFAULT true, "organisationId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9e8795cfc899ab7bdaa831e8527" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_aa2d7fb6adbd25c621fa4d8d70" ON "webhooks" ("organisationId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."visites_statut_enum" AS ENUM('planifiee', 'en_cours', 'completee', 'annulee')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."visites_etatgeneral_enum" AS ENUM('normale', 'stress', 'maladie', 'ravageur', 'carence', 'autre')`,
    );
    await queryRunner.query(
      `CREATE TABLE "visites" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "parcelleId" character varying NOT NULL, "technicienId" character varying NOT NULL, "date" TIMESTAMP NOT NULL, "statut" "public"."visites_statut_enum" NOT NULL DEFAULT 'planifiee', "organisationId" character varying, "campagneId" character varying, "dureeMinutes" integer, "objectif" character varying, "observations" text, "etatGeneral" "public"."visites_etatgeneral_enum", "observationsDetaillees" jsonb NOT NULL DEFAULT '[]', "recommandations" text, "prochainAction" character varying, "gpsLocation" jsonb, "photos" jsonb NOT NULL DEFAULT '[]', "rapport" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_65c2109828af78567f9aa12c1bf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7e24263c3fbf9d48395936734f" ON "visites" ("organisationId", "date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_339519a546730d28a28e3e7d2c" ON "visites" ("technicienId", "statut") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c1cbb0b2a54c257e2fa3daf895" ON "visites" ("parcelleId", "date") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('directeur', 'superviseur', 'technicien', 'admin', 'partenaire')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying, "phone" character varying, "passwordHash" character varying NOT NULL, "nom" character varying NOT NULL, "prenom" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'technicien', "organisationId" character varying, "equipeId" character varying, "avatar" character varying, "actif" boolean NOT NULL DEFAULT true, "otpCode" character varying, "otpExpiry" TIMESTAMP, "loginAttempts" integer NOT NULL DEFAULT '0', "lockedUntil" TIMESTAMP, "refreshTokenHash" character varying, "apiKeyHash" character varying, "apiScopes" jsonb NOT NULL DEFAULT '[]', "fcmToken" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone"), CONSTRAINT "UQ_e6187374899bd04b3bf740bb881" UNIQUE ("apiKeyHash"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0b29ba6be03a10ac3dad7a0edd" ON "users" ("equipeId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bece041caf3640a727e069f241" ON "users" ("organisationId", "role") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."expert_requests_status_enum" AS ENUM('queued', 'sent', 'received', 'answered')`,
    );
    await queryRunner.query(
      `CREATE TABLE "expert_requests" ("id" character varying NOT NULL, "parcelId" character varying NOT NULL, "photoPaths" jsonb NOT NULL DEFAULT '[]', "context" text NOT NULL, "remoteId" character varying, "status" "public"."expert_requests_status_enum" NOT NULL DEFAULT 'queued', "answer" text, "answeredAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_841a7c2acce7e6d5e791abff295" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_76210537660327d823ed3d9e7e" ON "expert_requests" ("createdAt") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."agro_rules_crop_enum" AS ENUM('riz', 'mais', 'mil', 'arachide', 'oignon', 'tomate', '*')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."agro_rules_season_enum" AS ENUM('hivernage', 'contre_saison', '*')`,
    );
    await queryRunner.query(
      `CREATE TABLE "agro_rules" ("id" character varying NOT NULL, "crop" "public"."agro_rules_crop_enum" NOT NULL, "stages" jsonb NOT NULL, "symptom" character varying NOT NULL, "season" "public"."agro_rules_season_enum" NOT NULL, "regions" jsonb NOT NULL, "severityMin" double precision NOT NULL DEFAULT '0', "diagnosis" text NOT NULL, "recommendation" jsonb NOT NULL, "validatedBy" character varying, "actif" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e575aa68f68bd2c4dfc3cbae486" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8a32b7275c751f760fe44d3be9" ON "agro_rules" ("crop", "symptom", "actif") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f45da0aa661fbc33f43cbac855" ON "agro_rules" ("updatedAt") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."satellite_indices_indexcode_enum" AS ENUM('evi', 'savi', 'ndwi', 'lai', 'ndvi')`,
    );
    await queryRunner.query(
      `CREATE TABLE "satellite_indices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "parcelleId" character varying NOT NULL, "indexCode" "public"."satellite_indices_indexcode_enum" NOT NULL, "date" TIMESTAMP NOT NULL, "meanValue" double precision NOT NULL, "minValue" double precision, "maxValue" double precision, "stddev" double precision, "resolutionMeters" integer NOT NULL DEFAULT '10', "source" character varying NOT NULL DEFAULT 'sentinel-2-l2a', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "uq_parcelle_index_date" UNIQUE ("parcelleId", "indexCode", "date"), CONSTRAINT "PK_343d5e6b48f37a9d195c66ebb45" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_77755ab8fc724be9501f9607ce" ON "satellite_indices" ("parcelleId", "indexCode", "date") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."taches_statut_enum" AS ENUM('todo', 'en_cours', 'done', 'reporte')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."taches_priorite_enum" AS ENUM('basse', 'normale', 'haute', 'urgente')`,
    );
    await queryRunner.query(
      `CREATE TABLE "taches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "titre" character varying NOT NULL, "description" text, "parcelleId" character varying NOT NULL, "assigneAId" character varying NOT NULL, "creeParId" character varying NOT NULL, "campagneId" character varying, "organisationId" character varying, "statut" "public"."taches_statut_enum" NOT NULL DEFAULT 'todo', "priorite" "public"."taches_priorite_enum" NOT NULL DEFAULT 'normale', "datePlanifiee" TIMESTAMP, "dateFin" TIMESTAMP, "dateTerminee" TIMESTAMP, "automatique" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c57a3acf0fc14cb922724b41c90" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_61cea002ab5f491173ba618d67" ON "taches" ("organisationId", "priorite", "statut") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_75a93e882679bc8e3fa43a2bdc" ON "taches" ("assigneAId", "statut") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7d5f5633a8584f9b86ec26ee70" ON "taches" ("parcelleId", "statut") `,
    );
    await queryRunner.query(
      `CREATE TABLE "api_keys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organisationId" character varying NOT NULL, "partenaireNom" character varying NOT NULL, "prefix" character varying(16) NOT NULL, "keyHash" character varying NOT NULL, "scopes" jsonb NOT NULL DEFAULT '[]', "quotaPerHour" integer NOT NULL DEFAULT '1000', "quotaPerMonth" integer NOT NULL DEFAULT '50000', "active" boolean NOT NULL DEFAULT true, "expiresAt" TIMESTAMP, "lastUsedAt" TIMESTAMP, "revokedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5c8a79801b44bd27b79228e1dad" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6f6105c8efe05b310d046cbdb3" ON "api_keys" ("prefix") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_df3637c0d9d231e69c13ba6620" ON "api_keys" ("organisationId", "active") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."parcelles_culture_enum" AS ENUM('riz', 'mais', 'mil', 'arachide', 'oignon', 'tomate', 'autre')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."parcelles_stade_enum" AS ENUM('semis', 'levee', 'vegetative', 'tallage', 'floraison', 'fruiting', 'maturation', 'recolte')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."parcelles_statut_enum" AS ENUM('sain', 'attention', 'urgent', 'recolte')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."parcelles_typecampagne_enum" AS ENUM('hivernage', 'contre_saison_froide', 'contre_saison_chaude')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."parcelles_cultureprecedente_enum" AS ENUM('riz', 'mais', 'mil', 'arachide', 'oignon', 'tomate')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."parcelles_rotationprevue_enum" AS ENUM('riz', 'mais', 'mil', 'arachide', 'oignon', 'tomate')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."parcelles_modeaccesterre_enum" AS ENUM('propriete', 'pret', 'location', 'communautaire')`,
    );
    await queryRunner.query(
      `CREATE TABLE "parcelles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying NOT NULL, "nom" character varying NOT NULL, "producteurNom" character varying NOT NULL, "exploitantNom" character varying, "localite" character varying, "boundary" jsonb, "centroid" jsonb, "superficie" double precision NOT NULL, "zone" character varying, "typesSol" character varying, "culture" "public"."parcelles_culture_enum", "stade" "public"."parcelles_stade_enum", "statut" "public"."parcelles_statut_enum" NOT NULL DEFAULT 'sain', "typeCampagne" "public"."parcelles_typecampagne_enum", "dateSemis" TIMESTAMP, "variete" character varying, "densite" character varying, "culturePrecedente" "public"."parcelles_cultureprecedente_enum", "rotationPrevue" "public"."parcelles_rotationprevue_enum", "typeSol" character varying, "zoneAgroecologique" character varying, "region" character varying, "sourceEau" character varying, "modeAccesTerre" "public"."parcelles_modeaccesterre_enum", "technicienId" character varying, "organisationId" character varying, "equipeId" character varying, "healthScore" double precision NOT NULL DEFAULT '0', "rendementPrecedent" double precision, "derniereVisite" TIMESTAMP, "prochaineVisite" TIMESTAMP, "deleted" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_0d8fbbf7a7e163256450692fd7a" UNIQUE ("code"), CONSTRAINT "PK_37bb14058d6d27239fed047a0d3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8e7a8d9f5ae0d88331c5f7574f" ON "parcelles" ("deleted", "organisationId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b005b509b70001db56c72dc1c3" ON "parcelles" ("technicienId", "statut") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_31f3ad41011db96abc3a921523" ON "parcelles" ("organisationId", "statut", "culture") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."recoltes_statut_enum" AS ENUM('en_attente', 'validee', 'rejetee')`,
    );
    await queryRunner.query(
      `CREATE TABLE "recoltes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "parcelleId" character varying NOT NULL, "technicienId" character varying NOT NULL, "organisationId" character varying, "dateRecolte" TIMESTAMP NOT NULL, "quantiteRecoltee" double precision NOT NULL, "superficie" double precision NOT NULL, "pertesPostRecolte" double precision NOT NULL DEFAULT '0', "prixVente" double precision, "rendement" double precision, "tauxPerte" double precision, "revenuTotal" double precision, "qualite" character varying, "statut" "public"."recoltes_statut_enum" NOT NULL DEFAULT 'en_attente', "observations" text, "attestationUrl" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6343e1b79d617a65d8496492743" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ba1930ca5fdc30dbf58a07c3aa" ON "recoltes" ("organisationId", "dateRecolte") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bb2727a5c3f75153448e7687ac" ON "recoltes" ("parcelleId", "dateRecolte") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."field_pois_type_enum" AS ENUM('puits', 'forage', 'bassin', 'canal', 'depot', 'bati', 'autre')`,
    );
    await queryRunner.query(
      `CREATE TABLE "field_pois" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "parcelleId" character varying NOT NULL, "nom" character varying NOT NULL, "type" "public"."field_pois_type_enum", "location" jsonb, "description" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4e568c27d0a3c67ed70f83873c8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5a477505902f99a8e746cc4b82" ON "field_pois" ("parcelleId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."organisations_type_enum" AS ENUM('cooperative', 'GIE', 'ONG', 'institution', 'agro_dealer', 'autre')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."organisations_subscriptionplan_enum" AS ENUM('free', 'basic', 'pro', 'enterprise')`,
    );
    await queryRunner.query(
      `CREATE TABLE "organisations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nom" character varying NOT NULL, "sigle" character varying, "type" "public"."organisations_type_enum" NOT NULL DEFAULT 'cooperative', "pays" character varying NOT NULL DEFAULT 'SN', "region" character varying, "adresse" character varying, "telephone" character varying, "email" character varying, "logoUrl" character varying, "siteWeb" character varying, "subscriptionPlan" "public"."organisations_subscriptionplan_enum" NOT NULL DEFAULT 'free', "subscriptionExpiry" TIMESTAMP, "apiCredentials" jsonb NOT NULL DEFAULT '{}', "actif" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_df146886595457139ae94d74b08" UNIQUE ("email"), CONSTRAINT "PK_7bf54cba378d5b2f1d4c10ef4df" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ed38c0e0ed495b355307c42a74" ON "organisations" ("pays", "type") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('alerte', 'avertissement', 'succes', 'info')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "type" "public"."notifications_type_enum" NOT NULL, "titre" character varying NOT NULL, "message" text NOT NULL, "lue" boolean NOT NULL DEFAULT false, "lienId" character varying, "lienType" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c2d2744681f37be4e43cf12079" ON "notifications" ("userId", "lue", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "ndvi_data" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "parcelleId" character varying NOT NULL, "date" TIMESTAMP NOT NULL, "ndviMoyen" double precision NOT NULL, "ndviMin" double precision, "ndviMax" double precision, "resolution" integer NOT NULL DEFAULT '10', "source" character varying NOT NULL DEFAULT 'sentinel-2', "zones" jsonb NOT NULL DEFAULT '[]', "tileUrl" character varying, "imageUrl" character varying, "cloudCoverage" double precision, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0439cd6822ddc32b0756bf67f23" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_90c6a229a7480c5ad0ddeab071" ON "ndvi_data" ("parcelleId", "date") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."market_prices_culture_enum" AS ENUM('riz', 'mais', 'mil', 'arachide', 'oignon', 'tomate', 'mangue', 'niebe')`,
    );
    await queryRunner.query(
      `CREATE TABLE "market_prices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "culture" "public"."market_prices_culture_enum" NOT NULL, "marche" character varying NOT NULL, "region" character varying, "date" date NOT NULL, "prixFcfaPerKg" double precision NOT NULL, "source" character varying NOT NULL DEFAULT 'manuel', "notes" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "uq_culture_marche_date" UNIQUE ("culture", "marche", "date"), CONSTRAINT "PK_cb959017562b6fe816d5a5c91dd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f3db5d283508372371ef6facd2" ON "market_prices" ("culture", "marche", "date") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."mouvements_type_enum" AS ENUM('entree', 'sortie')`,
    );
    await queryRunner.query(
      `CREATE TABLE "mouvements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "intrantId" character varying NOT NULL, "type" "public"."mouvements_type_enum" NOT NULL, "quantite" double precision NOT NULL, "date" TIMESTAMP, "parcelleId" character varying, "motif" character varying, "operateurId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a1caaf7b4d76b71ccd239d82871" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d1a760873495bdd01240e433a2" ON "mouvements" ("parcelleId", "date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0b4c5ff06a9841a0d4010d0536" ON "mouvements" ("intrantId", "date") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."intrants_type_enum" AS ENUM('Engrais', 'Pesticide', 'Semence', 'Autre')`,
    );
    await queryRunner.query(
      `CREATE TABLE "intrants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nom" character varying NOT NULL, "type" "public"."intrants_type_enum" NOT NULL, "marque" character varying, "description" text, "unite" character varying NOT NULL, "quantiteStock" double precision NOT NULL DEFAULT '0', "seuilAlerte" double precision, "prixUnitaire" double precision, "dateExpiration" TIMESTAMP, "organisationId" character varying NOT NULL, "deleted" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_57b715b020e2da1ff99cdbd52f0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_71a82c2f6ae60a1a86dee54218" ON "intrants" ("organisationId", "quantiteStock") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_18529df626154c8f11fcbb6680" ON "intrants" ("organisationId", "type") `,
    );
    await queryRunner.query(
      `CREATE TABLE "equipes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nom" character varying NOT NULL, "description" text, "responsableId" character varying, "organisationId" character varying NOT NULL, "actif" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9f0bfc492ee9542b0c0f42eb21d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_66b7cae7d432b3f84508f94028" ON "equipes" ("organisationId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."diagnostics_severite_enum" AS ENUM('faible', 'modere', 'severe', 'critique')`,
    );
    await queryRunner.query(
      `CREATE TABLE "diagnostics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "parcelleId" character varying NOT NULL, "organisationId" character varying, "userId" character varying NOT NULL, "culture" character varying, "imageHash" character varying, "imageBytes" integer, "identification" character varying, "confidence" double precision NOT NULL DEFAULT '0', "severite" "public"."diagnostics_severite_enum", "symptomes" text, "traitements" jsonb NOT NULL DEFAULT '[]', "preventionConseils" text, "rawResponse" jsonb, "model" character varying NOT NULL DEFAULT 'claude-sonnet-4-6', "inputTokens" integer, "outputTokens" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2bb20db72fbfd9dc034f6ee7e55" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bfd6224b5d73d78e13062555c1" ON "diagnostics" ("organisationId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b7e4a020a65d9c9cfd28c4458d" ON "diagnostics" ("parcelleId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."campagnes_type_enum" AS ENUM('hivernage', 'contre_saison_froide', 'contre_saison_chaude')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."campagnes_statut_enum" AS ENUM('en_preparation', 'en_cours', 'terminee')`,
    );
    await queryRunner.query(
      `CREATE TABLE "campagnes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nom" character varying NOT NULL, "type" "public"."campagnes_type_enum" NOT NULL, "dateDebut" TIMESTAMP NOT NULL, "dateFin" TIMESTAMP, "statut" "public"."campagnes_statut_enum" NOT NULL DEFAULT 'en_preparation', "progressionPct" double precision, "objectifRendement" double precision, "observationsCloture" text, "rendementFinal" double precision, "parcelleIds" jsonb NOT NULL DEFAULT '[]', "organisationId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e9f03fba877b9d2a709786c7aab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_012f1311562108c3efd618af21" ON "campagnes" ("organisationId", "statut") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subscriptions_status_enum" AS ENUM('active', 'pending_payment', 'trial', 'past_due', 'cancelled', 'expired')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subscriptions_periodicite_enum" AS ENUM('mensuel', 'annuel')`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organisationId" character varying NOT NULL, "planId" character varying NOT NULL, "planCode" character varying NOT NULL, "status" "public"."subscriptions_status_enum" NOT NULL DEFAULT 'trial', "periodicite" "public"."subscriptions_periodicite_enum" NOT NULL DEFAULT 'mensuel', "periodStartedAt" TIMESTAMP NOT NULL, "periodEndsAt" TIMESTAMP NOT NULL, "autoRenew" boolean NOT NULL DEFAULT false, "cancelledAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_83eb326360887040f42135ef206" UNIQUE ("organisationId"), CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6f5aa379818c971510c71dc561" ON "subscriptions" ("periodEndsAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6048b323b7b474ac72756bdb7b" ON "subscriptions" ("organisationId", "status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."plans_code_enum" AS ENUM('free', 'pro', 'enterprise')`,
    );
    await queryRunner.query(
      `CREATE TABLE "plans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" "public"."plans_code_enum" NOT NULL, "nom" character varying NOT NULL, "prixMensuelFcfa" integer NOT NULL DEFAULT '0', "prixAnnuelFcfa" integer NOT NULL DEFAULT '0', "maxParcelles" integer, "maxUtilisateurs" integer, "maxDiagnosticsParMois" integer, "maxAppelsApiParMois" integer, "ndviInclus" boolean NOT NULL DEFAULT false, "whatsappInclus" boolean NOT NULL DEFAULT false, "exportSigInclus" boolean NOT NULL DEFAULT false, "diagnosticIaInclus" boolean NOT NULL DEFAULT false, "actif" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3720521a81c7c24fe9b7202ba61" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_95f7ef3fc4c31a3545b4d825dd" ON "plans" ("code") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_intents_provider_enum" AS ENUM('manual', 'wave', 'orange_money', 'stripe')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_intents_status_enum" AS ENUM('pending', 'processing', 'succeeded', 'failed', 'expired')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payment_intents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organisationId" character varying NOT NULL, "subscriptionId" character varying NOT NULL, "montantFcfa" integer NOT NULL, "provider" "public"."payment_intents_provider_enum" NOT NULL DEFAULT 'manual', "status" "public"."payment_intents_status_enum" NOT NULL DEFAULT 'pending', "providerRef" character varying, "providerPayload" jsonb, "paidAt" TIMESTAMP, "notes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cc99975b98c8001a336976fd018" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f51305b44b123cfaffec0abe97" ON "payment_intents" ("providerRef") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d05b41b5d2961e91e13b8fc4d3" ON "payment_intents" ("organisationId", "status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."benchmarks_rendement_culture_enum" AS ENUM('riz', 'mais', 'mil', 'arachide', 'oignon', 'tomate')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."benchmarks_rendement_typecampagne_enum" AS ENUM('hivernage', 'contre_saison_froide', 'contre_saison_chaude')`,
    );
    await queryRunner.query(
      `CREATE TABLE "benchmarks_rendement" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "culture" "public"."benchmarks_rendement_culture_enum" NOT NULL, "zoneAgroecologique" character varying, "variete" character varying, "typeCampagne" "public"."benchmarks_rendement_typecampagne_enum", "rendementMoyenTHa" double precision NOT NULL, "rendementMinTHa" double precision, "rendementMaxTHa" double precision, "cycleJours" integer, "source" character varying NOT NULL DEFAULT 'ISRA', "anneeReference" integer, "notes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "uq_benchmark" UNIQUE ("culture", "zoneAgroecologique", "variete", "typeCampagne"), CONSTRAINT "PK_5f90f886484a9e253277a89b261" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_74135a9e28ffa33c448656289f" ON "benchmarks_rendement" ("culture", "zoneAgroecologique") `,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid, "organisationId" uuid, "action" character varying(128) NOT NULL, "resource" character varying(128), "resourceId" character varying(128), "severity" character varying(16) NOT NULL DEFAULT 'info', "method" character varying(8), "path" character varying(512), "statusCode" smallint, "ip" character varying(64), "userAgent" character varying(512), "changes" jsonb, "metadata" jsonb, "errorMessage" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_action" ON "audit_logs" ("action") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_resource" ON "audit_logs" ("resource", "resourceId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_user_created" ON "audit_logs" ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_org_created" ON "audit_logs" ("organisationId", "createdAt") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_audit_org_created"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_user_created"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_resource"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_action"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_74135a9e28ffa33c448656289f"`,
    );
    await queryRunner.query(`DROP TABLE "benchmarks_rendement"`);
    await queryRunner.query(
      `DROP TYPE "public"."benchmarks_rendement_typecampagne_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."benchmarks_rendement_culture_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d05b41b5d2961e91e13b8fc4d3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f51305b44b123cfaffec0abe97"`,
    );
    await queryRunner.query(`DROP TABLE "payment_intents"`);
    await queryRunner.query(`DROP TYPE "public"."payment_intents_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."payment_intents_provider_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_95f7ef3fc4c31a3545b4d825dd"`,
    );
    await queryRunner.query(`DROP TABLE "plans"`);
    await queryRunner.query(`DROP TYPE "public"."plans_code_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6048b323b7b474ac72756bdb7b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6f5aa379818c971510c71dc561"`,
    );
    await queryRunner.query(`DROP TABLE "subscriptions"`);
    await queryRunner.query(
      `DROP TYPE "public"."subscriptions_periodicite_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."subscriptions_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_012f1311562108c3efd618af21"`,
    );
    await queryRunner.query(`DROP TABLE "campagnes"`);
    await queryRunner.query(`DROP TYPE "public"."campagnes_statut_enum"`);
    await queryRunner.query(`DROP TYPE "public"."campagnes_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b7e4a020a65d9c9cfd28c4458d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bfd6224b5d73d78e13062555c1"`,
    );
    await queryRunner.query(`DROP TABLE "diagnostics"`);
    await queryRunner.query(`DROP TYPE "public"."diagnostics_severite_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_66b7cae7d432b3f84508f94028"`,
    );
    await queryRunner.query(`DROP TABLE "equipes"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_18529df626154c8f11fcbb6680"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_71a82c2f6ae60a1a86dee54218"`,
    );
    await queryRunner.query(`DROP TABLE "intrants"`);
    await queryRunner.query(`DROP TYPE "public"."intrants_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0b4c5ff06a9841a0d4010d0536"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d1a760873495bdd01240e433a2"`,
    );
    await queryRunner.query(`DROP TABLE "mouvements"`);
    await queryRunner.query(`DROP TYPE "public"."mouvements_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f3db5d283508372371ef6facd2"`,
    );
    await queryRunner.query(`DROP TABLE "market_prices"`);
    await queryRunner.query(`DROP TYPE "public"."market_prices_culture_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_90c6a229a7480c5ad0ddeab071"`,
    );
    await queryRunner.query(`DROP TABLE "ndvi_data"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c2d2744681f37be4e43cf12079"`,
    );
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ed38c0e0ed495b355307c42a74"`,
    );
    await queryRunner.query(`DROP TABLE "organisations"`);
    await queryRunner.query(
      `DROP TYPE "public"."organisations_subscriptionplan_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."organisations_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5a477505902f99a8e746cc4b82"`,
    );
    await queryRunner.query(`DROP TABLE "field_pois"`);
    await queryRunner.query(`DROP TYPE "public"."field_pois_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bb2727a5c3f75153448e7687ac"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ba1930ca5fdc30dbf58a07c3aa"`,
    );
    await queryRunner.query(`DROP TABLE "recoltes"`);
    await queryRunner.query(`DROP TYPE "public"."recoltes_statut_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_31f3ad41011db96abc3a921523"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b005b509b70001db56c72dc1c3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8e7a8d9f5ae0d88331c5f7574f"`,
    );
    await queryRunner.query(`DROP TABLE "parcelles"`);
    await queryRunner.query(
      `DROP TYPE "public"."parcelles_modeaccesterre_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."parcelles_rotationprevue_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."parcelles_cultureprecedente_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."parcelles_typecampagne_enum"`);
    await queryRunner.query(`DROP TYPE "public"."parcelles_statut_enum"`);
    await queryRunner.query(`DROP TYPE "public"."parcelles_stade_enum"`);
    await queryRunner.query(`DROP TYPE "public"."parcelles_culture_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_df3637c0d9d231e69c13ba6620"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6f6105c8efe05b310d046cbdb3"`,
    );
    await queryRunner.query(`DROP TABLE "api_keys"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7d5f5633a8584f9b86ec26ee70"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_75a93e882679bc8e3fa43a2bdc"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_61cea002ab5f491173ba618d67"`,
    );
    await queryRunner.query(`DROP TABLE "taches"`);
    await queryRunner.query(`DROP TYPE "public"."taches_priorite_enum"`);
    await queryRunner.query(`DROP TYPE "public"."taches_statut_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_77755ab8fc724be9501f9607ce"`,
    );
    await queryRunner.query(`DROP TABLE "satellite_indices"`);
    await queryRunner.query(
      `DROP TYPE "public"."satellite_indices_indexcode_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f45da0aa661fbc33f43cbac855"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8a32b7275c751f760fe44d3be9"`,
    );
    await queryRunner.query(`DROP TABLE "agro_rules"`);
    await queryRunner.query(`DROP TYPE "public"."agro_rules_season_enum"`);
    await queryRunner.query(`DROP TYPE "public"."agro_rules_crop_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_76210537660327d823ed3d9e7e"`,
    );
    await queryRunner.query(`DROP TABLE "expert_requests"`);
    await queryRunner.query(`DROP TYPE "public"."expert_requests_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bece041caf3640a727e069f241"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0b29ba6be03a10ac3dad7a0edd"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c1cbb0b2a54c257e2fa3daf895"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_339519a546730d28a28e3e7d2c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7e24263c3fbf9d48395936734f"`,
    );
    await queryRunner.query(`DROP TABLE "visites"`);
    await queryRunner.query(`DROP TYPE "public"."visites_etatgeneral_enum"`);
    await queryRunner.query(`DROP TYPE "public"."visites_statut_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_aa2d7fb6adbd25c621fa4d8d70"`,
    );
    await queryRunner.query(`DROP TABLE "webhooks"`);
    await queryRunner.query(`DROP TYPE "public"."webhooks_evenement_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_260ef9f2c53f5539a72afb5695"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_430e0d8da5c37725bc0ea6dfb9"`,
    );
    await queryRunner.query(`DROP TABLE "whatsapp_messages"`);
    await queryRunner.query(
      `DROP TYPE "public"."whatsapp_messages_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."whatsapp_messages_direction_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b5e28b74a59c2dedf05210bb53"`,
    );
    await queryRunner.query(`DROP TABLE "whatsapp_optins"`);
  }
}
