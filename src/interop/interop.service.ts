import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";

@Injectable()
export class InteropService {
  constructor(private configService: ConfigService) {}

  validateInsuranceSignature(signature: string, rawBody: string): void {
    if (!signature) {
      throw new UnauthorizedException("Signature webhook manquante");
    }
    const secret = this.configService.get<string>(
      "INSURANCE_WEBHOOK_SECRET",
      "",
    );
    if (!secret) {
      throw new InternalServerErrorException(
        "INSURANCE_WEBHOOK_SECRET non configuré",
      );
    }
    const expected =
      "sha256=" +
      createHmac("sha256", secret).update(rawBody).digest("hex");
    try {
      const sigBuf = Buffer.from(signature.padEnd(expected.length));
      const expBuf = Buffer.from(expected);
      if (
        sigBuf.length !== expBuf.length ||
        !timingSafeEqual(sigBuf, expBuf)
      ) {
        throw new UnauthorizedException("Signature webhook invalide");
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException("Signature webhook invalide");
    }
  }

  /**
   * Signs an outbound payload for a bank/insurance partner.
   * Returns headers to attach to the HTTP response.
   * Anti-replay: callers MUST verify timestamp is within 5 min window on receipt.
   */
  signOutbound(data: object): {
    timestamp: string;
    signature: string;
  } {
    const secret = this.configService.get<string>("INTEROP_BANK_SECRET", "");
    if (!secret) {
      throw new InternalServerErrorException(
        "INTEROP_BANK_SECRET non configuré",
      );
    }
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = `${timestamp}.${JSON.stringify(data)}`;
    const signature =
      "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
    return { timestamp, signature };
  }

  async getScoreCredit(nationalId: string) {
    const report = {
      identifiant: nationalId,
      score_agricole: 74,
      niveau_risque: "FAIBLE",
      capacite_remboursement_fcfa: 850000,
      surface_exploitee_ha: 5.2,
      productions: [
        {
          annee: 2024,
          culture: "arachide",
          rendement_t_ha: 1.4,
          qualite: "B",
        },
        { annee: 2025, culture: "riz", rendement_t_ha: 4.8, qualite: "A" },
      ],
      nb_visites_12_mois: 8,
      parcelles_certifiees: 3,
      certifie_par: "Petalia AgroAssist",
      date_rapport: new Date().toISOString().split("T")[0],
    };
    const { timestamp, signature } = this.signOutbound(report);
    return {
      data: report,
      meta: {
        signature_algo: "HMAC-SHA256",
        signature_format: "sha256=hex(HMAC(secret, timestamp + '.' + body))",
        timestamp,
        signature,
      },
    };
  }

  async getRecoltesCertifiees(nationalId: string) {
    return { nationalId, recoltes: [] };
  }

  async getIndexNdvi(indexId: string) {
    return { indexId, index: 0.72 };
  }

  async declareSinistre(_data: any) {
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

  async creditNotification(_data: any) {
    return { received: true };
  }

  async indemnisationWebhook(_data: any) {
    return { received: true, processed_at: new Date().toISOString() };
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

  async declarationCampagne(_data: any) {
    return { id: "decl-001", status: "recue" };
  }
}
