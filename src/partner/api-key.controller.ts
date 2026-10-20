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
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  ALL_SCOPES,
  ApiKeyKind,
  ApiKeyMode,
  ApiKeyScope,
} from "./entities/api-key.entity";
import { Audit } from "../audit/decorators/audit.decorator";
import { encodeId } from "../public-api/common/ids";

class CreateApiKeyDto {
  @IsString()
  @MaxLength(120)
  partenaireNom: string;

  @IsOptional()
  @IsArray()
  @IsIn(ALL_SCOPES, { each: true })
  scopes?: ApiKeyScope[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quotaPerHour?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  quotaPerMonth?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  /** "test" keys only see sandbox data. */
  @IsOptional()
  @IsIn(["live", "test"])
  mode?: ApiKeyMode;

  /** "publishable" keys (pk_) only reach open data. */
  @IsOptional()
  @IsIn(["secret", "publishable"])
  kind?: ApiKeyKind;
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
  @Audit({
    action: "partner.apikey.create",
    resource: "api_key",
    severity: "warning",
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
      mode: body.mode,
      kind: body.kind,
    });
    return {
      id: apiKey.id,
      // OAuth2 client_id for POST /api/v1/oauth/token (client_secret = rawKey).
      clientId: encodeId("api_key", apiKey.id),
      partenaireNom: apiKey.partenaireNom,
      prefix: apiKey.prefix,
      scopes: apiKey.scopes,
      mode: apiKey.mode,
      kind: apiKey.kind,
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
  @Audit({
    action: "partner.apikey.revoke",
    resource: "api_key",
    severity: "warning",
  })
  async revoke(@Param("id") id: string, @TenantId() tenantId: string | null) {
    if (!tenantId) throw new Error("Organisation requise");
    await this.service.revoke(id, tenantId);
    return { ok: true };
  }
}
