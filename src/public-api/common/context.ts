import { Locale } from "../public-api.constants";

export interface PublicClient {
  /** Data owner for this call: the real organisation, or its sandbox twin in test mode. */
  organizationId: string;
  /** The real organisation that owns the API key (billing, profile). */
  accountOrganizationId: string;
  apiKeyId: string;
  scopes: string[];
  /** false for sk_test_/pk_test_ keys: they only see sandbox data. */
  livemode: boolean;
  kind: "secret" | "publishable";
  via: "api_key" | "oauth";
}

export interface PublicApiContext {
  version: string;
  locale: Locale;
  requestId: string;
  client?: PublicClient;
}
