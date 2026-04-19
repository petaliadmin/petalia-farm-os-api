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
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("Notifications")
@Controller("notifications")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.notificationsService.findAll(req.user.sub);
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
