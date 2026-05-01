import {
  Injectable,
  Logger,
  InternalServerErrorException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";

export interface VisionDiagnosticResult {
  identification: string;
  confidence: number;
  severite: "faible" | "modere" | "severe" | "critique";
  symptomes: string;
  traitements: {
    produit: string;
    matiereActive?: string;
    dose: string;
    modeApplication?: string;
    prescriptionAgreee?: boolean;
  }[];
  preventionConseils: string;
}

export interface VisionResponse {
  result: VisionDiagnosticResult;
  raw: object;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1500;

const SYSTEM_PROMPT = `Tu es un expert en diagnostic phytosanitaire spécialisé dans l'agriculture sahélienne (Sénégal, Mali, Burkina, Niger).

Cultures principales: riz, mil, maïs, arachide, oignon, tomate, mangue, niébé.

À partir de la photo et du contexte fournis (culture, stade), identifie:
1. La maladie, le ravageur ou le déséquilibre nutritionnel le plus probable
2. La sévérité visible (faible, modere, severe, critique)
3. Un traitement adapté avec produits homologués au Sénégal (CSP/CILSS) ou alternatives bio (neem, savon noir, etc.)
4. Des conseils de prévention adaptés au contexte paysan

RÈGLES STRICTES:
- Ne JAMAIS recommander de produit non homologué CILSS
- Privilégier les solutions agroécologiques quand possible
- Préciser la dose en l/ha, kg/ha ou ml par pulvérisateur 16L
- Si l'image n'est pas exploitable, retourner identification="indeterminé" avec confidence=0
- Répondre UNIQUEMENT en JSON valide selon le schéma demandé. Aucun texte hors JSON.`;

@Injectable()
export class ClaudeVisionClient {
  private readonly logger = new Logger(ClaudeVisionClient.name);
  private readonly client: Anthropic | null;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>("ANTHROPIC_API_KEY");
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn(
        "ANTHROPIC_API_KEY non configuré — /diagnostic/photo retournera 503",
      );
    }
  }

  async diagnose(
    imageBase64: string,
    mediaType: "image/jpeg" | "image/png" | "image/webp",
    culture: string | null,
    stade: string | null,
    descriptionFaite: string | null,
  ): Promise<VisionResponse> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        "Service IA non configuré (ANTHROPIC_API_KEY manquant)",
      );
    }

    const userPrompt = this.buildUserPrompt(culture, stade, descriptionFaite);

    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: imageBase64,
                },
              },
              { type: "text", text: userPrompt },
            ],
          },
        ],
      });

      const textBlock = response.content.find((c) => c.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("Aucun bloc texte dans la réponse Claude");
      }
      const result = this.parseResult(textBlock.text);
      return {
        result,
        raw: response as unknown as object,
        model: response.model,
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        },
      };
    } catch (err) {
      const e = err as Error;
      this.logger.error(`Claude Vision diagnostic failed: ${e.message}`);
      if (e.message.includes("rate")) {
        throw new ServiceUnavailableException("IA surchargée, réessayer");
      }
      throw new InternalServerErrorException(
        "Diagnostic IA indisponible",
      );
    }
  }

  private buildUserPrompt(
    culture: string | null,
    stade: string | null,
    description: string | null,
  ): string {
    const parts: string[] = [];
    if (culture) parts.push(`Culture: ${culture}`);
    if (stade) parts.push(`Stade phénologique: ${stade}`);
    if (description) parts.push(`Description observation: ${description}`);
    parts.push("");
    parts.push("Réponds en JSON STRICT au format:");
    parts.push(
      `{
  "identification": "string court (ex: 'Pyriculariose du riz', 'Carence en azote', 'Foreur de tige')",
  "confidence": 0.0-1.0,
  "severite": "faible|modere|severe|critique",
  "symptomes": "description visible 1-2 phrases",
  "traitements": [
    { "produit": "...", "matiereActive": "...", "dose": "...", "modeApplication": "...", "prescriptionAgreee": true/false }
  ],
  "preventionConseils": "1-3 conseils prévention 1-2 phrases"
}`,
    );
    return parts.join("\n");
  }

  private parseResult(text: string): VisionDiagnosticResult {
    // Strip ```json fences if Claude wraps the answer
    const cleaned = text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      this.logger.error(`JSON parse failed for Claude output: ${text.slice(0, 200)}`);
      throw new InternalServerErrorException(
        "Réponse IA non parsable",
      );
    }
    return {
      identification: String(parsed.identification ?? "indeterminé"),
      confidence: Number(parsed.confidence ?? 0),
      severite:
        ["faible", "modere", "severe", "critique"].includes(parsed.severite)
          ? parsed.severite
          : "faible",
      symptomes: String(parsed.symptomes ?? ""),
      traitements: Array.isArray(parsed.traitements)
        ? parsed.traitements.map((t: any) => ({
            produit: String(t.produit ?? ""),
            matiereActive: t.matiereActive ? String(t.matiereActive) : undefined,
            dose: String(t.dose ?? ""),
            modeApplication: t.modeApplication
              ? String(t.modeApplication)
              : undefined,
            prescriptionAgreee:
              t.prescriptionAgreee === true || t.prescriptionAgreee === false
                ? t.prescriptionAgreee
                : undefined,
          }))
        : [],
      preventionConseils: String(parsed.preventionConseils ?? ""),
    };
  }
}
