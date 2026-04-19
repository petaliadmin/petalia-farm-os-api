import { Injectable } from "@nestjs/common";

@Injectable()
export class RapportsService {
  async getKpis(periode: "semaine" | "mois" | "saison" = "mois") {
    // In production, these would be aggregated from MongoDB
    return {
      data: {
        visitesRealisees: 24,
        haCouvertes: 89,
        tachesClosees: 18,
        coutIntrants: 1840000,
        rendementMoyen: 4.1,
        tauxAlertesResolues: 82,
      },
    };
  }

  async getGraphiques() {
    return {
      data: {
        rendementParCulture: [
          { culture: "Riz", rendement: 4.8, objectif: 5.0, emoji: "🌾" },
          { culture: "Arachide", rendement: 1.4, objectif: 1.5, emoji: "🥜" },
          { culture: "Maïs", rendement: 3.2, objectif: 4.0, emoji: "🌽" },
          { culture: "Oignon", rendement: 18.5, objectif: 20.0, emoji: "🧅" },
          { culture: "Tomate", rendement: 22.0, objectif: 25.0, emoji: "🍅" },
          { culture: "Mil", rendement: 0.9, objectif: 1.0, emoji: "🌿" },
        ],
        topProblemes: [
          { nom: "Pyriculariose", count: 5, type: "maladie" },
          { nom: "Foreur de tige", count: 3, type: "ravageur" },
          { nom: "Mildiou", count: 3, type: "maladie" },
          { nom: "Chenille légionnaire", count: 2, type: "ravageur" },
          { nom: "Stress hydrique", count: 2, type: "stress" },
        ],
        activiteMensuelle: [
          { semaine: "S40", visites: 8, taches: 12 },
          { semaine: "S41", visites: 12, taches: 15 },
          { semaine: "S42", visites: 6, taches: 9 },
          { semaine: "S43", visites: 10, taches: 11 },
        ],
      },
    };
  }

  async exportRapport(data: { format: string; type: string; periode: string }) {
    // In production, this would generate a PDF via PDFKit
    return {
      data: {
        url: "https://cdn.cloudinary.com/petalia/rapports/Rapport_PetaliaFarmOS_2026-04-19.pdf",
        nom: "Rapport_PetaliaFarmOS_2026-04-19.pdf",
      },
    };
  }

  async getEconomiques() {
    return {
      data: {
        totalRecettes: 8500000,
        totalDepenses: 4200000,
        marge: 4300000,
        rendimientoMoyen: 4.2,
      },
    };
  }
}
