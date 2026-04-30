import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";

import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("Notifications")
@Controller("notifications")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  findAll(
    @Request() req: any,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.notificationsService.findAll(req.user.sub, {
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get("non-lues")
  findNonLues(@Request() req: any) {
    return this.notificationsService.findNonLues(req.user.sub);
  }

  @Get("count")
  getCount(@Request() req: any) {
    return this.notificationsService.getCount(req.user.sub);
  }

  @Patch(":id/lue")
  marcarLue(@Param("id") id: string) {
    return this.notificationsService.marquerLue(id);
  }

  @Post("marquer-toutes-lues")
  marquerToutesLues(@Request() req: any) {
    return this.notificationsService.marquerToutesLues(req.user.sub);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.notificationsService.remove(id);
  }
}
