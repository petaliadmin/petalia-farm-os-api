import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { SkipTenantScope } from "../common/decorators/skip-tenant-scope.decorator";
import {
  CurrentDeveloper,
  DeveloperAuthGuard,
  DeveloperSession,
} from "./developer-auth.guard";
import { DeveloperService } from "./developer.service";
import {
  CreateDeveloperKeyDto,
  LoginDto,
  ResendDto,
  SignupDto,
  VerifyDto,
} from "./dto/developer.dto";

/** Inscription, envoi de SMS et connexion : limites strictes par adresse IP */
const AUTH_THROTTLE = { global: { limit: 5, ttl: 60_000 } };

@ApiTags("Espace développeur — comptes")
@Controller("developer/auth")
@SkipTenantScope()
export class DeveloperAuthController {
  constructor(private readonly developers: DeveloperService) {}

  @Post("signup")
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({
    summary:
      "Créer un compte développeur (code de vérification envoyé par SMS)",
  })
  signup(@Body() dto: SignupDto) {
    return this.developers.signup(dto);
  }

  @Post("verify")
  @HttpCode(200)
  @Throttle({ global: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Vérifier le téléphone et ouvrir la session" })
  verify(@Body() dto: VerifyDto) {
    return this.developers.verify(dto.email, dto.code);
  }

  @Post("resend")
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: "Renvoyer le code de vérification" })
  resend(@Body() dto: ResendDto) {
    return this.developers.resend(dto.email);
  }

  @Post("login")
  @HttpCode(200)
  @Throttle({ global: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Se connecter (jeton de 2 h)" })
  login(@Body() dto: LoginDto) {
    return this.developers.login(dto);
  }
}

@ApiTags("Espace développeur — clés d'API")
@Controller("developer")
@UseGuards(DeveloperAuthGuard)
@SkipTenantScope()
@ApiBearerAuth()
export class DeveloperController {
  constructor(private readonly developers: DeveloperService) {}

  @Get("me")
  @ApiOperation({ summary: "Compte, tarif et limites applicables aux clés" })
  me(@CurrentDeveloper() dev: DeveloperSession) {
    return this.developers.me(dev);
  }

  @Get("api-keys")
  @ApiOperation({ summary: "Clés de l'organisation (sans leur valeur)" })
  list(@CurrentDeveloper() dev: DeveloperSession) {
    return this.developers.listKeys(dev);
  }

  @Post("api-keys")
  @Throttle({ global: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      "Générer une clé : expiration obligatoire, quotas fixés par le mode (test / live) et le tarif",
  })
  create(
    @CurrentDeveloper() dev: DeveloperSession,
    @Body() dto: CreateDeveloperKeyDto,
  ) {
    return this.developers.createKey(dev, dto);
  }

  @Delete("api-keys/:id")
  @ApiOperation({
    summary: "Révoquer une clé (effet immédiat, jetons OAuth compris)",
  })
  revoke(
    @CurrentDeveloper() dev: DeveloperSession,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.developers.revokeKey(dev, id);
  }
}
