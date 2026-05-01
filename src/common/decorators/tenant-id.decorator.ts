import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";

export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as AuthenticatedUser | undefined;
    return user?.organisationId ?? null;
  },
);
