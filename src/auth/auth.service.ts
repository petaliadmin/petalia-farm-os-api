import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { UsersService } from "../users/users.service";
import {
  LoginDto,
  LoginResponseDto,
  RefreshDto,
  ChangePasswordDto,
} from "./dto/auth.dto";
import { User } from "../users/schemas/user.schema";

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
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

    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        equipeId: user.equipeId?.toString(),
        avatar: user.avatar,
        token,
      },
    };
  }

  async logout(userId: string): Promise<void> {
    // Fire-and-forget logout for Angular
    // Could invalidate token in Redis here if needed
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

      const newPayload = { sub: user.id, email: user.email, role: user.role };
      const token = this.jwtService.sign(newPayload);
      const expiresIn = 8 * 60 * 60; // 8 hours in seconds

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
    await this.usersService.update(userId, { passwordHash: newPasswordHash });

    return { success: true };
  }

  async getProfile(userId: string): Promise<User> {
    return this.usersService.findById(userId);
  }

  async updateProfile(
    userId: string,
    updateData: Partial<User>,
  ): Promise<User> {
    return this.usersService.update(userId, updateData);
  }

  async forgotPassword(
    email: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return {
        success: true,
        message: "Si le compte existe, un email sera envoyé",
      };
    }
    // In production, would generate reset token and send email
    return {
      success: true,
      message: "Si le compte existe, un email sera envoyé",
    };
  }

  async sendOtp(
    phone: string,
  ): Promise<{ success: boolean; expiresIn: number }> {
    const user = await this.usersService.findByPhone(phone);
    if (!user) {
      return { success: true, expiresIn: 300 };
    }
    // In production, would generate 6-digit OTP and send via Orange SMS
    // OTP stored in user.otpCode (hashed) and user.otpExpiry
    return { success: true, expiresIn: 300 };
  }

  async verifyOtp(phone: string, code: string): Promise<LoginResponseDto> {
    const user = await this.usersService.findByPhone(phone);
    if (!user) {
      return {
        success: false,
        error: "Numéro non enregistré",
      } as LoginResponseDto;
    }

    // In production, verify OTP against stored hash
    if (code !== "123456") {
      // Demo code
      return { success: false, error: "Code invalide" } as LoginResponseDto;
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        equipeId: user.equipeId?.toString(),
        avatar: user.avatar,
        token,
      },
    };
  }
}
