import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { DiagnosticService } from "./diagnostic.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface";

@ApiTags("Diagnostic IA")
@Controller("diagnostic")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DiagnosticController {
  constructor(private readonly service: DiagnosticService) {}

  @Post("photo")
  @UseInterceptors(FileInterceptor("photo", { limits: { fileSize: 8 * 1024 * 1024 } }))
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      "Diagnostic phytosanitaire IA (Claude Vision) — POST multipart photo",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        photo: { type: "string", format: "binary" },
        parcelleId: { type: "string", format: "uuid" },
        description: { type: "string" },
      },
      required: ["photo", "parcelleId"],
    },
  })
  diagnose(
    @UploadedFile() photo: Express.Multer.File,
    @Body("parcelleId") parcelleId: string,
    @Body("description") description: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @TenantId() tenantId: string | null,
  ) {
    return this.service.diagnose(
      parcelleId,
      user.sub,
      tenantId,
      description ?? null,
      photo,
    );
  }

  @Get("parcelle/:parcelleId")
  @ApiOperation({ summary: "Historique diagnostics d'une parcelle" })
  list(
    @Param("parcelleId") parcelleId: string,
    @TenantId() tenantId: string | null,
  ) {
    return this.service.listForParcelle(parcelleId, tenantId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Détail d'un diagnostic" })
  getOne(@Param("id") id: string, @TenantId() tenantId: string | null) {
    return this.service.getOne(id, tenantId);
  }
}
