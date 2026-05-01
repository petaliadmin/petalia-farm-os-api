import { SetMetadata } from "@nestjs/common";
import { ApiKeyScope } from "../entities/api-key.entity";

export const SCOPES_KEY = "apiKeyScopes";
export const RequireScopes = (...scopes: ApiKeyScope[]) =>
  SetMetadata(SCOPES_KEY, scopes);
