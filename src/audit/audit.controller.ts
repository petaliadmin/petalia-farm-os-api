import {
  Controller,
  Get,
  Query,
  UseGuards,
  ForbiddenException,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AuditService } from "./audit.service";
import { AuditSeverity } from "./entities/audit-log.entity";
import { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface";

@ApiTags("Audit")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("audit-logs")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({
    summary:
      "Liste paginée des journaux d'audit (admin et directeur uniquement)",
  })
  async list(
    @Req() req: { user: AuthenticatedUser },
    @Query("userId") userId?: string,
    @Query("action") action?: string,
    @Query("resource") resource?: string,
    @Query("resourceId") resourceId?: string,
    @Query("severity") severity?: AuditSeverity,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const role = req.user.role;
    if (role !== "admin" && role !== "directeur") {
      throw new ForbiddenException(
        "Accès au journal d'audit réservé aux administrateurs",
      );
    }

    // Directeur is scoped to their own organisation; admin sees everything
    const organisationId =
      role === "admin" ? undefined : (req.user.organisationId ?? undefined);

    const { data, total } = await this.audit.query({
      userId,
      organisationId,
      action,
      resource,
      resourceId,
      severity,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return { data, meta: { total, page: page ?? 1, limit: limit ?? 50 } };
  }
}
