import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import {
  ContactRequestDto,
  DemoRequestDto,
  ListWebsiteRequestsQueryDto,
  OrderRequestDto,
  UpdateWebsiteRequestDto,
} from "./dto/website.dto";
import { WebsiteService } from "./website.service";

/** Limite par adresse IP sur les formulaires publics (anti-spam) */
const FORM_THROTTLE = { global: { limit: 5, ttl: 60_000 } };

/**
 * Formulaires du site vitrine petalia.sn — sans authentification.
 * /api/public/contact reprend le contrat déjà utilisé par le site.
 */
@ApiTags("Site vitrine (public)")
@Controller("public")
export class WebsitePublicController {
  constructor(private readonly website: WebsiteService) {}

  @Post("contact")
  @HttpCode(201)
  @Throttle(FORM_THROTTLE)
  @ApiOperation({ summary: "Formulaire de contact du site" })
  contact(@Body() dto: ContactRequestDto) {
    return this.website.submitContact(dto);
  }

  @Post("demo-requests")
  @HttpCode(201)
  @Throttle(FORM_THROTTLE)
  @ApiOperation({ summary: "Demande de démo gratuite sur l'exploitation" })
  demo(@Body() dto: DemoRequestDto) {
    return this.website.submitDemo(dto);
  }

  @Post("orders")
  @HttpCode(201)
  @Throttle(FORM_THROTTLE)
  @ApiOperation({
    summary: "Demande de commande de la boutique IoT (devis à confirmer)",
  })
  order(@Body() dto: OrderRequestDto) {
    return this.website.submitOrder(dto);
  }
}

/** Suivi des demandes du site par l'équipe Pétalia. */
@ApiTags("Site vitrine (back-office)")
@Controller("website/requests")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin", "directeur")
@ApiBearerAuth()
export class WebsiteAdminController {
  constructor(private readonly website: WebsiteService) {}

  @Get()
  @ApiOperation({ summary: "Lister les demandes (filtres type, statut)" })
  list(@Query() query: ListWebsiteRequestsQueryDto) {
    return this.website.list(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Lire une demande" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.website.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Changer le statut ou la note interne" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateWebsiteRequestDto,
  ) {
    return this.website.update(id, dto);
  }
}
