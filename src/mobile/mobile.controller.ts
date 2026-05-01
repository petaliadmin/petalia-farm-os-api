import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
} from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { MobileService } from "./mobile.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface";

class BatchSyncDto {
  since?: string;
  resources?: string;
  actions?: any[];
}

@ApiTags("Mobile (Flutter)")
@Controller("mobile")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@SkipThrottle() // mobile clients hit these endpoints frequently from low-bandwidth networks
export class MobileController {
  constructor(private readonly mobile: MobileService) {}

  @Get("dashboard")
  @ApiOperation({
    summary:
      "Aggrégat home Flutter en 1 appel — KPI + parcelles top + tâches du jour + alertes + météo zones",
  })
  @ApiOkResponse({
    description:
      "Payload compact optimisé 3G/Edge. ETag (cacheVersion) pour skip transfert.",
  })
  @Header("Cache-Control", "private, max-age=60")
  async dashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const payload = await this.mobile.dashboard(
      user.sub,
      user.role,
      user.organisationId,
    );
    const etag = `W/"${payload.cacheVersion}"`;
    res.setHeader("ETag", etag);
    if (ifNoneMatch && ifNoneMatch === etag) {
      res.status(HttpStatus.NOT_MODIFIED);
      return undefined;
    }
    return payload;
  }

  @Post("batch-sync")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Push + Pull en 1 round-trip — réduit le coût data/latence Flutter offline-first",
  })
  batchSync(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: BatchSyncDto,
  ) {
    return this.mobile.batchSync(
      user.sub,
      user.role,
      user.organisationId,
      body ?? {},
    );
  }
}
