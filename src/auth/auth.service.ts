import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import * as bcrypt from "bcrypt";
import { randomInt, randomBytes } from "crypto";
import { UsersService } from "../users/users.service";
import { User } from "../users/entities/user.entity";
import {
  LoginDto,
  LoginResponseDto,
  RefreshDto,
  ChangePasswordDto,
} from "./dto/auth.dto";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      return user;
    }
    return null;
  }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      return {
        success: false,
        error: "Email ou mot de passe incorrect",
      } as LoginResponseDto;
    }

    if (!user.actif) {
      return {
        success: false,
        error: "Compte désactivé. Veuillez contacter l'administrateur.",
      } as LoginResponseDto;
    }

    const token = this.signToken(user);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        equipeId: user.equipeId,
        avatar: user.avatar,
        token,
      },
    };
  }

  async logout(_userId: string): Promise<void> {
    // JWT blacklist via Redis can be added here (audit finding M6)
  }

  async refresh(
    refreshDto: RefreshDto,
  ): Promise<{ token: string; expiresIn: number }> {
    try {
      const payload = this.jwtService.verify(refreshDto.token);
      const user = await this.usersService.findById(payload.sub);

      if (!user || !user.actif) {
        throw new UnauthorizedException("Token invalide");
      }

      const token = this.signToken(user);
      const expiresIn = 8 * 60 * 60;

      return { token, expiresIn };
    } catch {
      throw new UnauthorizedException("Token invalide ou expiré");
    }
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ success: boolean }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException("Utilisateur non trouvé");
    }

    const isValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.passwordHash,
    );
    if (!isValid) {
      throw new BadRequestException("Mot de passe actuel incorrect");
    }

    const newPasswordHash = await bcrypt.hash(
      changePasswordDto.newPassword,
      12,
    );
    await this.usersService.update(userId, {
      passwordHash: newPasswordHash,
    } as any);

    return { success: true };
  }

  async getProfile(userId: string): Promise<User> {
    return this.usersService.findById(userId);
  }

  async updateProfile(
    userId: string,
    updateData: Partial<User>,
  ): Promise<User> {
    return this.usersService.update(userId, updateData as any);
  }

  async forgotPassword(
    email: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.usersService.findByEmail(email);
    // Always return the same message to prevent user enumeration
    const message = "Si le compte existe, un SMS/email vous sera envoyé";

    if (!user) {
      return { success: true, message };
    }

    const token = randomBytes(32).toString("hex");
    await this.cacheManager.set(`pwd_reset:${token}`, user.id, RESET_TTL_MS);

    // TODO Sprint 3: Send reset link via Orange SMS or SendGrid email
    // In development, log the token:
    if (this.configService.get("NODE_ENV") !== "production") {
      console.log(`[DEV] Reset token for ${email}: ${token}`);
    }

    return { success: true, message };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    const userId = await this.cacheManager.get<string>(`pwd_reset:${token}`);
    if (!userId) {
      throw new BadRequestException("Token invalide ou expiré");
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await this.usersService.update(userId, { passwordHash: hash } as any);
    await this.cacheManager.del(`pwd_reset:${token}`);

    return { success: true };
  }

  async sendOtp(
    phone: string,
  ): Promise<{ success: boolean; expiresIn: number }> {
    const user = await this.usersService.findByPhone(phone);
    if (!user) {
      // Return success to avoid phone enumeration
      return { success: true, expiresIn: 300 };
    }

    const code = randomInt(100000, 999999).toString();
    const hash = await bcrypt.hash(code, 8);
    await this.cacheManager.set(`otp:${phone}`, hash, OTP_TTL_MS);

    // TODO Sprint 3: Send via Orange SMS API
    if (this.configService.get("NODE_ENV") !== "production") {
      console.log(`[DEV] OTP for ${phone}: ${code}`);
    }

    return { success: true, expiresIn: 300 };
  }

  async verifyOtp(phone: string, code: string): Promise<LoginResponseDto> {
    const user = await this.usersService.findByPhone(phone);
    if (!user) {
      return { success: false, error: "Numéro non enregistré" } as LoginResponseDto;
    }

    const storedHash = await this.cacheManager.get<string>(`otp:${phone}`);
    if (!storedHash) {
      return { success: false, error: "Code expiré ou non envoyé" } as LoginResponseDto;
    }

    const isValid = await bcrypt.compare(code, storedHash);
    if (!isValid) {
      return { success: false, error: "Code invalide" } as LoginResponseDto;
    }

    // Consume OTP — one-time use
    await this.cacheManager.del(`otp:${phone}`);

    const token = this.signToken(user);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        equipeId: user.equipeId,
        avatar: user.avatar,
        token,
      },
    };
  }

  private signToken(user: User): string {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const expiresIn =
      this.configService.get<string>("JWT_EXPIRES_IN") || "8h";
    return this.jwtService.sign(payload, { expiresIn });
  }
}
