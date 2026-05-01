import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";
import { SKIP_TENANT_SCOPE } from "../decorators/skip-tenant-scope.decorator";

@Injectable()
export class TenantScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_SCOPE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) return true;

    if (user.role === "admin") return true;

    if (!user.organisationId) {
      throw new ForbiddenException(
        "Aucune organisation assignée à cet utilisateur",
      );
    }

    request.tenantId = user.organisationId;
    return true;
  }
}
