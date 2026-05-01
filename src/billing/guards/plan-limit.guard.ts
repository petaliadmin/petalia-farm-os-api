import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BillingService } from "../billing.service";
import { Parcelle } from "../../parcelles/entities/parcelle.entity";
import { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";

export const PLAN_LIMIT_KEY = "planLimit";
export type PlanLimitResource = "parcelles" | "utilisateurs";

import { SetMetadata } from "@nestjs/common";
export const EnforcePlanLimit = (resource: PlanLimitResource) =>
  SetMetadata(PLAN_LIMIT_KEY, resource);

/**
 * Bloque la création d'une parcelle (ou autre ressource quotée) si la
 * souscription active a atteint sa limite. Lit la limite via BillingService.
 *
 * Usage :
 *   @Post()
 *   @UseGuards(JwtAuthGuard, PlanLimitGuard)
 *   @EnforcePlanLimit("parcelles")
 *   create(...) {}
 */
@Injectable()
export class PlanLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private billing: BillingService,
    @InjectRepository(Parcelle) private parcelleRepo: Repository<Parcelle>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.getAllAndOverride<PlanLimitResource>(
      PLAN_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!resource) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as AuthenticatedUser | undefined;
    if (!user?.organisationId) return true; // admin sans tenant

    const plan = await this.billing.getActivePlanForOrg(user.organisationId);

    if (resource === "parcelles") {
      if (plan.maxParcelles === null || plan.maxParcelles === undefined) {
        return true;
      }
      const count = await this.parcelleRepo.count({
        where: { organisationId: user.organisationId, deleted: false },
      });
      if (count >= plan.maxParcelles) {
        throw new ForbiddenException(
          `Plan ${plan.code} : limite ${plan.maxParcelles} parcelles atteinte. Passez Pro pour étendre.`,
        );
      }
    }
    return true;
  }
}
