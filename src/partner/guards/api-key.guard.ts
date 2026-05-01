import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { ApiKeyService } from "../api-key.service";
import { ApiKey, ApiKeyScope } from "../entities/api-key.entity";
import { SCOPES_KEY } from "../decorators/scopes.decorator";

export interface PartnerRequestContext {
  apiKey: ApiKey;
  organisationId: string;
  scopes: ApiKeyScope[];
}

declare module "express-serve-static-core" {
  interface Request {
    partner?: PartnerRequestContext;
  }
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private apiKeys: ApiKeyService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const headerKey =
      (req.headers["x-api-key"] as string | undefined) ??
      this.fromAuthHeader(req.headers.authorization);
    const { apiKey, scopes } = await this.apiKeys.verify(headerKey ?? "");

    const required = this.reflector.getAllAndOverride<ApiKeyScope[]>(
      SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (required?.length) {
      for (const s of required) {
        if (!scopes.includes(s)) {
          throw new ForbiddenException(
            `Scope manquant pour cet endpoint: ${s}`,
          );
        }
      }
    }

    req.partner = {
      apiKey,
      organisationId: apiKey.organisationId,
      scopes,
    };
    return true;
  }

  private fromAuthHeader(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const m = /^Bearer\s+(pk_[A-Za-z0-9_-]+)$/.exec(value);
    return m ? m[1] : undefined;
  }
}
