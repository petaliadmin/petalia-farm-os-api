import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface";
import type { ApiKey, ApiKeyScope } from "../partner/entities/api-key.entity";
import type { PublicApiContext } from "../public-api/common/context";

export interface PartnerRequestContext {
  apiKey: ApiKey;
  organisationId: string;
  scopes: ApiKeyScope[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      partner?: PartnerRequestContext;
      /** Set by PublicApiContextMiddleware on every /api/v1 public route. */
      publicApi?: PublicApiContext;
    }
  }
}
