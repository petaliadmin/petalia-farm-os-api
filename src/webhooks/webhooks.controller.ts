import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { WebhooksService } from "./webhooks.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("Webhooks")
@Controller("webhooks")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Get()
  @Roles("admin", "directeur")
  findAll(@Query("organisationId") organisationId?: string) {
    return this.webhooksService.findAll(organisationId);
  }

  @Post()
  @Roles("admin")
  create(@Body() data: any) {
    return this.webhooksService.create(data);
  }

  @Patch(":id")
  @Roles("admin")
  update(@Param("id") id: string, @Body() data: any) {
    return this.webhooksService.update(id, data);
  }

  @Delete(":id")
  @Roles("admin")
  remove(@Param("id") id: string) {
    return this.webhooksService.remove(id);
  }

  @Post(":id/test")
  @Roles("admin")
  test(@Param("id") id: string) {
    return this.webhooksService.test(id);
  }
}
