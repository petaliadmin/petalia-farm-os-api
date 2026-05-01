import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { Throttle, SkipThrottle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import {
  LoginDto,
  RefreshDto,
  ChangePasswordDto,
  UpdateProfileDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  OtpSendDto,
  OtpVerifyDto,
} from "./dto/auth.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Connexion email/password — retourne JWT" })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post("logout")
  @SkipThrottle()
  @ApiOperation({ summary: "Déconnexion" })
  async logout(@Request() req: Request & { user: AuthenticatedUser }) {
    await this.authService.logout(req.user.sub);
    return {};
  }

  @Post("refresh")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Rafraîchir le token JWT" })
  async refresh(@Body() refreshDto: RefreshDto) {
    return this.authService.refresh(refreshDto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Profil utilisateur connecté" })
  async getProfile(@Request() req: Request & { user: AuthenticatedUser }) {
    const user = await this.authService.getProfile(req.user.sub);
    return { data: user };
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Mettre à jour le profil utilisateur" })
  async updateProfile(
    @Request() req: Request & { user: AuthenticatedUser },
    @Body() updateDto: UpdateProfileDto,
  ) {
    const user = await this.authService.updateProfile(req.user.sub, updateDto);
    return { data: user };
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: "Changer le mot de passe" })
  async changePassword(
    @Request() req: Request & { user: AuthenticatedUser },
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.sub, changePasswordDto);
  }

  @Post("forgot-password")
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: "Demander un lien de réinitialisation" })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post("reset-password")
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: "Réinitialiser le mot de passe avec le token reçu" })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Post("login/otp/send")
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: "Envoyer code OTP par SMS" })
  async sendOtp(@Body() dto: OtpSendDto) {
    return this.authService.sendOtp(dto.phone);
  }

  @Post("login/otp/verify")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Vérifier code OTP" })
  async verifyOtp(@Body() dto: OtpVerifyDto) {
    return this.authService.verifyOtp(dto.phone, dto.code);
  }
}
