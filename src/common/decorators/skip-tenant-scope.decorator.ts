import { SetMetadata } from "@nestjs/common";

export const SKIP_TENANT_SCOPE = "skipTenantScope";

export const SkipTenantScope = () => SetMetadata(SKIP_TENANT_SCOPE, true);
