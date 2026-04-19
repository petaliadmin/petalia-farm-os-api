import { Injectable } from "@nestjs/common";

@Injectable()
export class InteropService {
  async getScoreCredit(nationalId: string) {
    // In production, would call Banque API
    return {
      identifiant: nationalId,
      score_agricole: 74,
      niveau_risque: "FAIBLE",
      capacite_remboursement_fcfa: 850000,
      surface_exploitee_ha: 5.2,
      productions: [
        { annee: 2024, culture: "arachide", rendement_t_ha: 1.4, qualite: "B" },
        { annee: 2025, culture: "riz", rendement_t_ha: 4.8, qualite: "A" },
      ],
      nb_visites_12_mois: 8,
      parcelles_certifiees: 3,
      certifie_par: "Petalia AgroAssist",
      date_rapport: new Date().toISOString().split("T")[0],
      signature_hmac: "sha256=abc123...",
    };
  }

  async getRecoltesCertifiees(nationalId: string) {
    // Would fetch certified harvest data
    return { nationalId, recoltes: [] };
  }

  async getIndexNdvi(indexId: string) {
    // Would fetch NDVI index for insurance
    return { indexId, index: 0.72 };
  }

  async declareSinistre(data: any) {
    return { id: "sin-001", status: "recu" };
  }

  async getStatistiques() {
    return {
      total_parcelles: 142,
      total_exploitants: 89,
      production_totale: 450,
    };
  }

  async getAgriculteur(nationalId: string) {
    return {
      identifiant: nationalId,
      nom: "Diallo",
      prenom: "Mamadou",
      superficie_totale: 5.2,
      nb_parcelles: 3,
    };
  }

  async creditNotification(data: any) {
    return { received: true };
  }

  async indemnisationWebhook(data: any) {
    return { received: true };
  }

  async getProductionRegion(region: string) {
    return {
      region,
      cultures: [
        { culture: "riz", superficie: 120, production: 576 },
        { culture: "arachide", superficie: 80, production: 112 },
      ],
    };
  }

  async declarationCampagne(data: any) {
    return { id: "decl-001", status: "recue" };
  }
}
