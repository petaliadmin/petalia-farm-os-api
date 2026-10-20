import { HttpException } from "@nestjs/common";
import { Translations } from "./i18n";

/**
 * Error catalogue of the public API. Every error is served as
 * application/problem+json (RFC 9457) with `type`, a translated `title` and
 * `detail`, and a stable machine-readable `code` integrators can switch on.
 *
 * Wolof strings were written for this first version and must be reviewed by
 * a native speaker before the developer portal goes public.
 */
interface ProblemDefinition {
  status: number;
  title: Translations;
  detail: Translations;
}

export const PROBLEMS = {
  authentication_required: {
    status: 401,
    title: {
      fr: "Authentification requise",
      en: "Authentication required",
      wo: "Dangay wara won ki nga doon",
    },
    detail: {
      fr: "Fournissez une clé secrète (Authorization: Bearer sk_...) ou un jeton OAuth2.",
      en: "Provide a secret key (Authorization: Bearer sk_...) or an OAuth2 access token.",
      wo: "Yónneel sa caabi bu kumpa (Authorization: Bearer sk_...) walla jeton OAuth2.",
    },
  },
  invalid_api_key: {
    status: 401,
    title: {
      fr: "Clé API invalide",
      en: "Invalid API key",
      wo: "Caabi API bi baaxul",
    },
    detail: {
      fr: "La clé fournie est inconnue, expirée ou révoquée.",
      en: "The key provided is unknown, expired or revoked.",
      wo: "Caabi bi xamuñu ko, jeexna walla dañu ko neenal.",
    },
  },
  invalid_client: {
    status: 401,
    title: {
      fr: "Client OAuth invalide",
      en: "Invalid OAuth client",
      wo: "Kiliyaan OAuth bi baaxul",
    },
    detail: {
      fr: "client_id ou client_secret incorrect.",
      en: "Incorrect client_id or client_secret.",
      wo: "client_id walla client_secret bi baaxul.",
    },
  },
  unsupported_grant_type: {
    status: 400,
    title: {
      fr: "Type d'autorisation non supporté",
      en: "Unsupported grant type",
      wo: "Xeetu ndigël bi nuyoo ko",
    },
    detail: {
      fr: "Seul grant_type=client_credentials est disponible pour l'instant.",
      en: "Only grant_type=client_credentials is available for now.",
      wo: "grant_type=client_credentials rekk la am léegi.",
    },
  },
  publishable_key_not_allowed: {
    status: 403,
    title: {
      fr: "Clé publiable non autorisée",
      en: "Publishable key not allowed",
      wo: "Caabi bu ñépp mënul def lii",
    },
    detail: {
      fr: "Cet endpoint exige une clé secrète (sk_...). Les clés pk_ ne donnent accès qu'aux données publiques.",
      en: "This endpoint requires a secret key (sk_...). pk_ keys only reach public data.",
      wo: "Fii dafa laaj caabi bu kumpa (sk_...). Caabi pk_ yi mënuñu jot lu dul xibaar yu ñépp.",
    },
  },
  insufficient_scope: {
    status: 403,
    title: {
      fr: "Permission manquante",
      en: "Missing permission",
      wo: "Sañ-sañ bi amul",
    },
    detail: {
      fr: "Cette clé n'a pas le scope requis : {scope}.",
      en: "This key lacks the required scope: {scope}.",
      wo: "Caabi bii amul scope bi ñu laaj : {scope}.",
    },
  },
  test_mode_only: {
    status: 403,
    title: {
      fr: "Réservé au mode test",
      en: "Test mode only",
      wo: "Mode test rekk",
    },
    detail: {
      fr: "Cet endpoint n'est disponible qu'avec une clé sk_test_.",
      en: "This endpoint is only available with an sk_test_ key.",
      wo: "Fii caabi sk_test_ rekk mën ko jëfandikoo.",
    },
  },
  resource_missing: {
    status: 404,
    title: {
      fr: "Ressource introuvable",
      en: "Resource not found",
      wo: "Gisuñu li ngay seet",
    },
    detail: {
      fr: "Aucune ressource « {id} » accessible avec cette clé.",
      en: "No resource '{id}' is accessible with this key.",
      wo: "Amul benn « {id} » boo mën a jot ak caabi bii.",
    },
  },
  route_missing: {
    status: 404,
    title: {
      fr: "Endpoint inconnu",
      en: "Unknown endpoint",
      wo: "Yoon wi xamuñu ko",
    },
    detail: {
      fr: "Aucun endpoint ne correspond à {method} {path}.",
      en: "No endpoint matches {method} {path}.",
      wo: "Amul benn yoon bu dëppoo ak {method} {path}.",
    },
  },
  validation_failed: {
    status: 422,
    title: {
      fr: "Requête invalide",
      en: "Invalid request",
      wo: "Laaj gi baaxul",
    },
    detail: {
      fr: "Un ou plusieurs champs sont invalides. Voir `errors`.",
      en: "One or more fields are invalid. See `errors`.",
      wo: "Am na ay tòol yu baaxul. Xoolal `errors`.",
    },
  },
  invalid_reference: {
    status: 422,
    title: {
      fr: "Référence invalide",
      en: "Invalid reference",
      wo: "Référence bi baaxul",
    },
    detail: {
      fr: "Le champ « {field} » doit contenir un identifiant {object} valide.",
      en: "Field '{field}' must hold a valid {object} identifier.",
      wo: "Tòol « {field} » war naa am id {object} bu baax.",
    },
  },
  invalid_geometry: {
    status: 422,
    title: {
      fr: "Géométrie invalide",
      en: "Invalid geometry",
      wo: "Natt wi baaxul",
    },
    detail: {
      fr: "{reason}",
      en: "{reason}",
      wo: "{reason}",
    },
  },
  invalid_unit: {
    status: 422,
    title: {
      fr: "Unité invalide",
      en: "Invalid unit",
      wo: "Natt bi baaxul",
    },
    detail: {
      fr: "La propriété « {property} » s'exprime en {expected}, pas en « {unit} ».",
      en: "Property '{property}' is expressed in {expected}, not '{unit}'.",
      wo: "« {property} » dañu koy natte ci {expected}, du « {unit} ».",
    },
  },
  unknown_property: {
    status: 422,
    title: {
      fr: "Propriété inconnue",
      en: "Unknown property",
      wo: "Xamuñu li",
    },
    detail: {
      fr: "« {property} » ne fait pas partie du vocabulaire Petalia. Voir GET /v1/observations/properties.",
      en: "'{property}' is not part of the Petalia vocabulary. See GET /v1/observations/properties.",
      wo: "« {property} » nekkul ci baat yi Petalia xam. Xoolal GET /v1/observations/properties.",
    },
  },
  invalid_cursor: {
    status: 400,
    title: {
      fr: "Curseur invalide",
      en: "Invalid cursor",
      wo: "Curseur bi baaxul",
    },
    detail: {
      fr: "Réutilisez tel quel le `next_cursor` renvoyé par l'API.",
      en: "Reuse the `next_cursor` returned by the API as-is.",
      wo: "Jëlal `next_cursor` bi API bi delloo te bul ko soppi.",
    },
  },
  unsupported_api_version: {
    status: 400,
    title: {
      fr: "Version d'API non supportée",
      en: "Unsupported API version",
      wo: "Version API bii nuyoo ko",
    },
    detail: {
      fr: "Petalia-Version « {version} » est inconnue. Versions disponibles : {supported}.",
      en: "Petalia-Version '{version}' is unknown. Available versions: {supported}.",
      wo: "Petalia-Version « {version} » xamuñu ko. Yi am : {supported}.",
    },
  },
  idempotency_key_reused: {
    status: 422,
    title: {
      fr: "Clé d'idempotence réutilisée",
      en: "Idempotency key reused",
      wo: "Idempotency-Key bi jëfandikoowoon nañu ko",
    },
    detail: {
      fr: "Cette Idempotency-Key a déjà servi pour une requête différente.",
      en: "This Idempotency-Key was already used for a different request.",
      wo: "Idempotency-Key bii jëfandikoowoon nañu ko ci beneen laaj.",
    },
  },
  idempotency_key_in_use: {
    status: 409,
    title: {
      fr: "Requête en cours",
      en: "Request in progress",
      wo: "Laaj gi ngi dox",
    },
    detail: {
      fr: "Une requête avec cette Idempotency-Key est en cours de traitement. Réessayez dans quelques secondes.",
      en: "A request with this Idempotency-Key is being processed. Retry in a few seconds.",
      wo: "Am na laaj bu am Idempotency-Key bii buñu ngi def. Jéemaatal ci ay saa.",
    },
  },
  farmer_already_registered: {
    status: 409,
    title: {
      fr: "Producteur déjà inscrit",
      en: "Farmer already registered",
      wo: "Beykat bi bindu na ba noppi",
    },
    detail: {
      fr: "Ce numéro est déjà rattaché à un producteur. Demandez son consentement via POST /v1/consents.",
      en: "This phone number already belongs to a farmer. Request their consent via POST /v1/consents.",
      wo: "Nimero bii am na boroom. Laajal ndigëlam ci POST /v1/consents.",
    },
  },
  consent_not_pending: {
    status: 409,
    title: {
      fr: "Consentement non modifiable",
      en: "Consent cannot change",
      wo: "Ndigël gi mënuñu ko soppi",
    },
    detail: {
      fr: "Ce consentement est « {status} » : l'opération n'est plus possible.",
      en: "This consent is '{status}': the operation is no longer possible.",
      wo: "Ndigël gi mi ngi « {status} » : mënatul nekk.",
    },
  },
  consent_invalid_code: {
    status: 422,
    title: {
      fr: "Code de confirmation invalide",
      en: "Invalid confirmation code",
      wo: "Kood bi baaxul",
    },
    detail: {
      fr: "Le code saisi est incorrect ou expiré. Tentatives restantes : {remaining}.",
      en: "The code is wrong or expired. Attempts left: {remaining}.",
      wo: "Kood bi baaxul walla jeex na. Jéem yi des : {remaining}.",
    },
  },
  scope_not_consentable: {
    status: 422,
    title: {
      fr: "Scope non délégable",
      en: "Scope cannot be consented",
      wo: "Scope bii mënuñu ko jox",
    },
    detail: {
      fr: "Un producteur ne peut pas accorder « {scope} » à un tiers.",
      en: "A farmer cannot grant '{scope}' to a third party.",
      wo: "Beykat mënul jox « {scope} » keneen.",
    },
  },
  channel_unavailable: {
    status: 422,
    title: {
      fr: "Canal indisponible",
      en: "Channel unavailable",
      wo: "Yoon wi amul",
    },
    detail: {
      fr: "Le canal « {channel} » n'est pas encore activé sur cette plateforme.",
      en: "Channel '{channel}' is not enabled on this platform yet.",
      wo: "Yoon « {channel} » taxul ci platform bi ba léegi.",
    },
  },
  farmer_unreachable: {
    status: 422,
    title: {
      fr: "Producteur injoignable",
      en: "Farmer unreachable",
      wo: "Beykat bi mënuñu ko jot",
    },
    detail: {
      fr: "{reason}",
      en: "{reason}",
      wo: "{reason}",
    },
  },
  upstream_unavailable: {
    status: 503,
    title: {
      fr: "Service partenaire indisponible",
      en: "Upstream service unavailable",
      wo: "Liggéeyu partenaire bi doxul",
    },
    detail: {
      fr: "{reason}",
      en: "{reason}",
      wo: "{reason}",
    },
  },
  rate_limited: {
    status: 429,
    title: {
      fr: "Trop de requêtes",
      en: "Too many requests",
      wo: "Laaj yi bari na lool",
    },
    detail: {
      fr: "{reason}",
      en: "{reason}",
      wo: "{reason}",
    },
  },
  internal_error: {
    status: 500,
    title: {
      fr: "Erreur interne",
      en: "Internal error",
      wo: "Njuumte ci biir",
    },
    detail: {
      fr: "Une erreur inattendue s'est produite. Communiquez le request_id au support.",
      en: "An unexpected error occurred. Share the request_id with support.",
      wo: "Am na njuumte. Yónnee request_id bi ñiy dimbali.",
    },
  },
} satisfies Record<string, ProblemDefinition>;

export type ProblemCode = keyof typeof PROBLEMS;

export interface FieldError {
  field: string;
  code: string;
  message?: string;
}

export interface ProblemOptions {
  params?: Record<string, unknown>;
  errors?: FieldError[];
  /** Extra members merged into the problem document (RFC 9457 §3.2). */
  extensions?: Record<string, unknown>;
}

/** Throw this from anywhere in the public API; the filter renders it. */
export class ProblemException extends HttpException {
  constructor(
    public readonly code: ProblemCode,
    public readonly problem: ProblemOptions = {},
  ) {
    super(code, PROBLEMS[code].status);
  }
}
