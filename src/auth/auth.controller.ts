import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import {
  LoginDto,
  RefreshDto,
  ChangePasswordDto,
  UpdateProfileDto,
} from "./dto/auth.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("login")
  @ApiOperation({
    summary:
      "Connexion utilisateur - retourne { success, user: { ...User, token } }",
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post("logout")
  @ApiOperation({ summary: "Déconnexion (fire-and-forget pour Angular)" })
  async logout(@Request() req: any) {
    await this.authService.logout(req.user?.sub);
    return {};
  }

  @Post("refresh")
  @ApiOperation({ summary: "Rafraîchir le token JWT" })
  async refresh(@Body() refreshDto: RefreshDto) {
    return this.authService.refresh(refreshDto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Profil utilisateur connecté" })
  async getProfile(@Request() req: any) {
    const user = await this.authService.getProfile(req.user.sub);
    return { data: user };
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Mettre à jour le profil utilisateur" })
  async updateProfile(
    @Request() req: any,
    @Body() updateDto: UpdateProfileDto,
  ) {
    const user = await this.authService.updateProfile(req.user.sub, updateDto);
    return { data: user };
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Changer le mot de passe" })
  async changePassword(
    @Request() req: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.sub, changePasswordDto);
  }

  @Post("forgot-password")
  @ApiOperation({ summary: "Demander un lien de réinitialisation" })
  async forgotPassword(@Body("email") email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post("login/otp/send")
  @ApiOperation({ summary: "Envoyer code OTP par SMS" })
  async sendOtp(@Body("phone") phone: string) {
    return this.authService.sendOtp(phone);
  }

  @Post("login/otp/verify")
  @ApiOperation({ summary: "Vérifier code OTP" })
  async verifyOtp(@Body() body: { phone: string; code: string }) {
    return this.authService.verifyOtp(body.phone, body.code);
  }
}
