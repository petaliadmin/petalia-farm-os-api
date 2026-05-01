import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiCreatedResponse,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { ApiKeyService } from "./api-key.service";
import { ApiKeyScope } from "./entities/api-key.entity";

class CreateApiKeyDto {
  partenaireNom: string;
  scopes?: ApiKeyScope[];
  quotaPerHour?: number;
  quotaPerMonth?: number;
  expiresAt?: string;
}

@ApiTags("Partner B2B (admin)")
@Controller("api-keys")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ApiKeyController {
  constructor(private readonly service: ApiKeyService) {}

  @Post()
  @Roles("admin", "directeur")
  @ApiOperation({
    summary:
      "Génère une nouvelle clé API B2B (la clé brute n'est retournée qu'une fois)",
  })
  @ApiCreatedResponse({
    description: "rawKey à transmettre au partenaire (non récupérable ensuite)",
  })
  async create(
    @Body() body: CreateApiKeyDto,
    @TenantId() tenantId: string | null,
  ) {
    if (!tenantId) {
      throw new Error("Organisation requise pour créer une clé API");
    }
    const { apiKey, rawKey } = await this.service.create({
      organisationId: tenantId,
      partenaireNom: body.partenaireNom,
      scopes: body.scopes,
      quotaPerHour: body.quotaPerHour,
      quotaPerMonth: body.quotaPerMonth,
      expiresAt: body.expiresAt,
    });
    return {
      id: apiKey.id,
      partenaireNom: apiKey.partenaireNom,
      prefix: apiKey.prefix,
      scopes: apiKey.scopes,
      quotaPerHour: apiKey.quotaPerHour,
      quotaPerMonth: apiKey.quotaPerMonth,
      expiresAt: apiKey.expiresAt,
      rawKey,
      avertissement:
        "Stockez immédiatement cette rawKey — elle ne sera plus jamais visible.",
    };
  }

  @Get()
  @Roles("admin", "directeur")
  list(@TenantId() tenantId: string | null) {
    if (!tenantId) return [];
    return this.service.listForOrg(tenantId);
  }

  @Delete(":id")
  @Roles("admin", "directeur")
  @ApiOperation({ summary: "Révoque immédiatement une clé API" })
  async revoke(
    @Param("id") id: string,
    @TenantId() tenantId: string | null,
  ) {
    if (!tenantId) throw new Error("Organisation requise");
    await this.service.revoke(id, tenantId);
    return { ok: true };
  }
}
