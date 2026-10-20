import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";

/** Audience des jetons de l'espace développeur : refusés par la plateforme (JwtStrategy). */
export const DEVELOPER_AUDIENCE = "petalia-developer";

export interface DeveloperSession {
  accountId: string;
  organisationId: string;
}

interface DeveloperJwtPayload {
  sub: string;
  org: string;
}

/** Vérifie le jeton développeur (secret et audience propres à l'espace développeur). */
@Injectable()
export class DeveloperAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { developer?: DeveloperSession }>();
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) throw new UnauthorizedException("Connexion requise");
    try {
      const payload = this.jwt.verify<DeveloperJwtPayload>(token, {
        audience: DEVELOPER_AUDIENCE,
      });
      req.developer = { accountId: payload.sub, organisationId: payload.org };
      return true;
    } catch {
      throw new UnauthorizedException("Session expirée : reconnectez-vous");
    }
  }
}

export const CurrentDeveloper = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): DeveloperSession =>
    ctx.switchToHttp().getRequest<{ developer: DeveloperSession }>().developer,
);
