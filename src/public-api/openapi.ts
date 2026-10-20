import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from "@nestjs/swagger";
import { Request, Response } from "express";
import {
  CURRENT_API_VERSION,
  EVENT_TYPES,
  PUBLIC_API_DOCS_BASE,
  PUBLIC_SCOPES,
} from "./public-api.constants";
import { PublicApiModule } from "./public-api.module";

const DESCRIPTION = `
API publique Petalia — la couche d'intégration agritech pour le Sénégal et l'Afrique de l'Ouest :
terrain (capteurs, satellite), acteurs (producteurs, coopératives) et canaux (SMS, WhatsApp, USSD, voix).

**Démarrer en 3 appels (sandbox)**
1. \`POST /api/v1/test_helpers/sandbox\` avec \`Authorization: Bearer sk_test_…\`
2. \`GET /api/v1/parcels\` — parcelles des Niayes, du Bassin arachidier et de la Vallée
3. \`GET /api/v1/observations?parcel=prc_…\` — 7 jours de mesures simulées

**Contrat**
- Versioning daté : en-tête \`Petalia-Version: ${CURRENT_API_VERSION}\` (12 mois de préavis avant retrait).
- IDs typés (\`fmr_\`, \`prc_\`, \`obs_\`…), unités explicites, horodatages ISO 8601 UTC.
- \`Idempotency-Key\` sur les POST : un renvoi rejoue la réponse au lieu de recréer.
- Pagination par curseur : \`limit\` + \`cursor\` = \`next_cursor\` précédent.
- Erreurs \`application/problem+json\` (RFC 9457), traduites selon \`Accept-Language\` (fr, en, wo).
- Clés \`sk_live_\` / \`sk_test_\` (secrètes), \`pk_…\` (données ouvertes), ou OAuth2 \`client_credentials\`.
- Les données d'un producteur appartiennent au producteur : hors de son organisation délégataire,
  l'accès passe par \`POST /api/v1/consents\` (confirmation par SMS) et chaque lecture est journalisée.
- Webhooks signés \`Petalia-Signature: t=…,v1=…\` (HMAC-SHA256), réessais exponentiels.

Scopes : ${PUBLIC_SCOPES.join(", ")}.
`.trim();

/** OpenAPI document restricted to the public API, with AIP custom methods fixed. */
export function buildPublicApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Petalia API")
    .setVersion(CURRENT_API_VERSION)
    .setDescription(DESCRIPTION)
    .setExternalDoc("Documentation", PUBLIC_API_DOCS_BASE)
    .addBearerAuth({
      type: "http",
      scheme: "bearer",
      description: "sk_live_… / sk_test_… ou jeton OAuth2",
    })
    .build();
  const document = SwaggerModule.createDocument(app, config, {
    include: [PublicApiModule],
  });

  // Express 4 cannot route a literal ":" — expose the real AIP-style path.
  const raw = "/api/v1/observations{verb}";
  if (document.paths[raw]) {
    const item = document.paths[raw];
    for (const op of Object.values(item)) {
      if (op && typeof op === "object" && "parameters" in op) {
        op.parameters = (op.parameters ?? []).filter(
          (p) => !("name" in p) || p.name !== "verb",
        );
      }
    }
    document.paths["/api/v1/observations:batch"] = item;
    delete document.paths[raw];
  }
  (document as OpenAPIObject & Record<string, unknown>)[
    "x-petalia-event-types"
  ] = [...EVENT_TYPES];
  return document;
}

/** llms.txt: a plain-text map of the API for AI agents and assistants. */
export function buildLlmsTxt(document: OpenAPIObject): string {
  const lines = [
    "# Petalia API",
    "",
    "> Agritech integration API for Senegal and West Africa: farmers (phone identity), parcels (GeoJSON), crop cycles, sensors and observations (explicit SI units), farmer consent, SMS/WhatsApp/USSD/voice notifications, signed webhooks.",
    "",
    `Base URL: /api/v1 — header Petalia-Version: ${CURRENT_API_VERSION} — auth: Authorization: Bearer sk_test_… (sandbox) or sk_live_…`,
    "Errors: application/problem+json (RFC 9457) with a stable `code`. Lists: { data, has_more, next_cursor }.",
    "Farmer data belongs to the farmer: outside the farmer's cooperative, access requires an active consent.",
    "",
    "## Endpoints",
  ];
  for (const [path, item] of Object.entries(document.paths)) {
    for (const [method, op] of Object.entries(item)) {
      if (!op || typeof op !== "object" || !("responses" in op)) continue;
      const summary = (op as { summary?: string }).summary ?? "";
      lines.push(
        `- ${method.toUpperCase()} ${path}${summary ? ` — ${summary}` : ""}`,
      );
    }
  }
  lines.push(
    "",
    "## Optional",
    `- OpenAPI: /api/v1/openapi.json`,
    `- Docs: ${PUBLIC_API_DOCS_BASE}`,
  );
  return lines.join("\n");
}

export function setupPublicApiDocs(app: INestApplication, swaggerCdn: string) {
  const document = buildPublicApiDocument(app);
  SwaggerModule.setup("api/v1/docs", app, document, {
    jsonDocumentUrl: "api/v1/openapi.json",
    customSiteTitle: "Petalia API",
    customCssUrl: `${swaggerCdn}/swagger-ui.css`,
    customJs: [
      `${swaggerCdn}/swagger-ui-bundle.js`,
      `${swaggerCdn}/swagger-ui-standalone-preset.js`,
    ],
  });
  const llms = buildLlmsTxt(document);
  app
    .getHttpAdapter()
    .get("/api/v1/llms.txt", (_req: Request, res: Response) => {
      res.type("text/plain; charset=utf-8").send(llms);
    });
}
