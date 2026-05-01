import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";
import { WhatsAppService } from "./whatsapp.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { SkipTenantScope } from "../common/decorators/skip-tenant-scope.decorator";
import { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface";

// -- Meta WhatsApp webhook payload types ------------------------------------

interface WhatsAppWebhookStatus {
  id: string;
  status: string;
  [key: string]: unknown;
}

interface WhatsAppTextBody {
  body: string;
}

interface WhatsAppButtonText {
  text: string;
}

interface WhatsAppInteractiveButtonReply {
  title: string;
}

interface WhatsAppInteractive {
  button_reply: WhatsAppInteractiveButtonReply;
}

interface WhatsAppWebhookMessage {
  id: string;
  from?: string;
  text?: WhatsAppTextBody;
  button?: WhatsAppButtonText;
  interactive?: WhatsAppInteractive;
  [key: string]: unknown;
}

interface WhatsAppWebhookValue {
  statuses?: WhatsAppWebhookStatus[];
  messages?: WhatsAppWebhookMessage[];
  [key: string]: unknown;
}

interface WhatsAppWebhookChange {
  value: WhatsAppWebhookValue;
  [key: string]: unknown;
}

interface WhatsAppWebhookEntry {
  changes: WhatsAppWebhookChange[];
  [key: string]: unknown;
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppWebhookEntry[];
  [key: string]: unknown;
}

class OptInDto {
  phoneE164: string;
  topics?: string[];
  language?: string;
}

@ApiTags("WhatsApp")
@Controller("whatsapp")
export class WhatsAppController {
  constructor(
    private readonly service: WhatsAppService,
    private readonly config: ConfigService,
  ) {}

  // -- Authenticated user-facing endpoints ----------------------------------

  @Post("opt-in")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Activer les notifications WhatsApp pour l'utilisateur courant",
  })
  optIn(@CurrentUser() user: AuthenticatedUser, @Body() body: OptInDto) {
    return this.service.optIn(
      user.sub,
      body.phoneE164,
      body.topics,
      body.language,
    );
  }

  @Delete("opt-in")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "D�sactiver WhatsApp (opt-out)" })
  optOut(@CurrentUser() user: AuthenticatedUser) {
    return this.service.optOut(user.sub).then(() => ({ ok: true }));
  }

  @Get("opt-in")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Statut opt-in courant" })
  getOptIn(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getOptin(user.sub);
  }

  @Get("messages")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Historique messages WhatsApp envoy�s" })
  history(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listOutboundForUser(user.sub);
  }

  // -- Public Meta webhook (no JWT, signed) ---------------------------------

  @Get("webhook")
  @SkipTenantScope()
  @ApiOperation({ summary: "Verify webhook (Meta hub.challenge)" })
  @ApiQuery({ name: "hub.mode", required: false })
  @ApiQuery({ name: "hub.verify_token", required: false })
  @ApiQuery({ name: "hub.challenge", required: false })
  verify(
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") token: string,
    @Query("hub.challenge") challenge: string,
  ): string {
    const expected = this.config.get<string>("WHATSAPP_VERIFY_TOKEN") ?? "";
    if (mode === "subscribe" && expected && token === expected) {
      return challenge;
    }
    return "";
  }

  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  @SkipTenantScope()
  @ApiOperation({
    summary: "Webhook entrant Meta (statuts + r�ponses producteurs)",
  })
  async ingest(
    @Req() req: Request,
    @Headers("x-hub-signature-256") signature: string | undefined,
    @Body() body: WhatsAppWebhookPayload,
  ) {
    this.verifySignature(req, signature);
    return this.service.ingestWebhook(body);
  }

  private verifySignature(req: Request, signature: string | undefined): void {
    const appSecret = this.config.get<string>("WHATSAPP_APP_SECRET") ?? "";
    if (!appSecret) {
      // No secret configured ? accept (dev only); production should always set it
      return;
    }
    if (!signature) {
      throw new Error("Signature webhook manquante");
    }
    const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
    if (!raw) {
      throw new Error(
        "rawBody indisponible � activer rawBody dans NestFactory.create",
      );
    }
    const expected =
      "sha256=" + createHmac("sha256", appSecret).update(raw).digest("hex");
    const a = Buffer.from(signature.padEnd(expected.length));
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("Signature webhook invalide");
    }
  }
}
