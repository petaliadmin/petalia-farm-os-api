import {
  IsEmail,
  IsString,
  MinLength,
  IsNotEmpty,
  IsOptional,
  Length,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  organisationId: string | null;
}

export class LoginDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "Petalia@2025!" })
  @IsString()
  @MinLength(8)
  password: string;
}

export class LoginResponseDto {
  success: boolean;
  user?: {
    id: string;
    email: string;
    nom: string;
    prenom: string;
    role: string;
    equipeId?: string;
    avatar?: string;
    token: string;
  };
  error?: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  prenom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\+?\d{8,15}$/, { message: "Numéro de téléphone invalide" })
  phone?: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class OtpSendDto {
  @ApiProperty({ example: "+221770000000" })
  @IsString()
  @Matches(/^\+?\d{8,15}$/, { message: "Numéro de téléphone invalide" })
  phone: string;
}

export class OtpVerifyDto {
  @ApiProperty({ example: "+221770000000" })
  @IsString()
  @Matches(/^\+?\d{8,15}$/, { message: "Numéro de téléphone invalide" })
  phone: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @Length(6, 6)
  code: string;
}
