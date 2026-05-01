import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface";
import type { ApiKey, ApiKeyScope } from "../partner/entities/api-key.entity";

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
    }
  }
}
