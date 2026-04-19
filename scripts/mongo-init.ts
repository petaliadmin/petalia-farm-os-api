// MongoDB Initialization Script
// This script creates the required indexes for Petalia backend

const { MongoClient } = require("mongodb");

async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/petalia";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();

    console.log("Creating indexes for parcelles collection...");
    await db.collection("parcelles").createIndex({ boundary: "2dsphere" });
    await db.collection("parcelles").createIndex({ centroid: "2dsphere" });
    await db
      .collection("parcelles")
      .createIndex({ organisationId: 1, statut: 1, culture: 1 });
    await db
      .collection("parcelles")
      .createIndex({ technicianId: 1, statut: 1 });
    await db.collection("parcelles").createIndex({ code: 1 }, { unique: true });
    await db
      .collection("parcelles")
      .createIndex({ deleted: 1, organisationId: 1 });

    console.log("Creating indexes for visites collection...");
    await db.collection("visites").createIndex({ parcelleId: 1, date: -1 });
    await db.collection("visites").createIndex({ technicianId: 1, statut: 1 });
    await db.collection("visites").createIndex({ organisationId: 1, date: -1 });
    await db
      .collection("visites")
      .createIndex({ gpsLocation: "2dsphere" }, { sparse: true });

    console.log("Creating indexes for taches collection...");
    await db.collection("taches").createIndex({ parcelleId: 1, statut: 1 });
    await db.collection("taches").createIndex({ assigneeId: 1, statut: 1 });
    await db
      .collection("taches")
      .createIndex({ organisationId: 1, priorite: 1, statut: 1 });

    console.log("Creating indexes for intrants collection...");
    await db.collection("intrants").createIndex({ organisationId: 1, type: 1 });
    await db
      .collection("intrants")
      .createIndex({ organisationId: 1, quantiteStock: 1 });
    await db
      .collection("intrants")
      .createIndex({ dateExpiration: 1 }, { sparse: true });

    console.log("Creating indexes for recoltes collection...");
    await db
      .collection("recoltes")
      .createIndex({ parcelleId: 1, dateRecolte: -1 });
    await db
      .collection("recoltes")
      .createIndex({ organisationId: 1, dateRecolte: -1 });

    console.log("Creating indexes for agro_rules collection...");
    await db
      .collection("agro_rules")
      .createIndex({ crop: 1, symptom: 1, actif: 1 });
    await db.collection("agro_rules").createIndex({ updatedAt: 1 });

    console.log("Creating indexes for notifications collection...");
    await db
      .collection("notifications")
      .createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days TTL
    await db
      .collection("notifications")
      .createIndex({ userId: 1, lue: 1, createdAt: -1 });

    console.log("Creating indexes for audit_logs collection...");
    await db
      .collection("audit_logs")
      .createIndex({ createdAt: 1 }, { expireAfterSeconds: 31536000 }); // 1 year TTL

    console.log("✅ Petalia MongoDB indexes created successfully");
  } catch (error) {
    console.error("Error creating indexes:", error);
  } finally {
    await client.close();
  }
}

main();
