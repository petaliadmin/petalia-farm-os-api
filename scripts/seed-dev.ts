// Development Seed Script
// Populates the database with initial data

import { NestFactory } from "@nestjs/core";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module";
import { User, UserSchema } from "../src/users/schemas/user.schema";
import { AgroRule, AgroRuleSchema } from "../src/sync/schemas/agro-rule.schema";

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const configService = app.get(ConfigService);
  const uri =
    configService.get("MONGODB_URI") || "mongodb://localhost:27017/petalia";

  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();

    // Create admin user
    const passwordHash = await bcrypt.hash("admin123", 12);
    const adminExists = await db
      .collection("users")
      .findOne({ email: "admin@petalia.sn" });

    if (!adminExists) {
      await db.collection("users").insertOne({
        email: "admin@petalia.sn",
        passwordHash,
        nom: "Diallo",
        prenom: "Admin",
        role: "admin",
        actif: true,
        createdAt: new Date(),
      });
      console.log("✅ Admin user created: admin@petalia.sn / admin123");
    }

    // Seed agro_rules (from Flutter assets)
    const rulesCount = await db.collection("agro_rules").countDocuments();
    if (rulesCount === 0) {
      const agroRules = [
        {
          id: "ARA-R1-YELLOW-SAHEL-RAINY",
          crop: "arachide",
          stages: ["vegetative", "flowering"],
          symptom: "yellow_leaves",
          season: "hivernage",
          regions: ["thies", "kaolack"],
          severityMin: 0.3,
          diagnosis: "Carence en fer possible due à un pH élevé du sol",
          recommendation: {
            title: "Apport fer + soufre",
            actions: ["Pulvériser sulfate de fer 2g/L", "Répéter J+7"],
            costFcfaPerHa: 15000,
            delayBeforeHarvestDays: 0,
            ppeRequired: false,
            followupDays: 7,
          },
          validatedBy: "ISRA Bambey",
          actif: true,
          createdAt: new Date(),
        },
        {
          id: "RIZ-R1-BLAST-DECA",
          crop: "riz",
          stages: ["tallage", "floraison"],
          symptom: "leaf_blast",
          season: "hivernage",
          regions: ["*"],
          severityMin: 0.2,
          diagnosis: "Pyriculariose (Magnaporthe oryzae)",
          recommendation: {
            title: "Traitement fongicide",
            actions: ["Appliquer Tricyclazole 75g/L", "Réduire azote"],
            costFcfaPerHa: 25000,
            delayBeforeHarvestDays: 21,
            ppeRequired: true,
            followupDays: 14,
          },
          validatedBy: "ISRA",
          actif: true,
          createdAt: new Date(),
        },
      ];

      await db.collection("agro_rules").insertMany(agroRules);
      console.log(`✅ ${agroRules.length} agro_rules seeded`);
    }

    console.log("✅ Development seed completed");
  } catch (error) {
    console.error("Seed error:", error);
  } finally {
    await client.close();
    await app.close();
  }
}

seed();
