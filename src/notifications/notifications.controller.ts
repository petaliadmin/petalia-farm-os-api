import {
  Controller,
  Get,
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
import { Request as ExpressRequest } from "express";
import { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface";

@ApiTags("Notifications")
@Controller("notifications")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  findAll(
    @Request() req: ExpressRequest & { user: AuthenticatedUser },
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.notificationsService.findAll(req.user.sub, {
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get("non-lues")
  findNonLues(@Request() req: ExpressRequest & { user: AuthenticatedUser }) {
    return this.notificationsService.findNonLues(req.user.sub);
  }

  @Get("count")
  getCount(@Request() req: ExpressRequest & { user: AuthenticatedUser }) {
    return this.notificationsService.getCount(req.user.sub);
  }

  @Patch(":id/lue")
  marquerLue(@Param("id") id: string) {
    return this.notificationsService.marquerLue(id);
  }

  @Delete(":id")
  delete(@Param("id") id: string) {
    return this.notificationsService.delete(id);
  }
}
