import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsNotEmpty,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

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
  currentPassword: string;

  @ApiProperty({ description: "Min 10 chars, 1 majuscule, 1 chiffre, 1 symbole" })
  @IsString()
  @MinLength(10)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&\-_#]).{10,}$/, {
    message:
      "Le mot de passe doit contenir au moins 10 caractères, une majuscule, un chiffre et un symbole",
  })
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

  @ApiProperty({ description: "Min 10 chars, 1 majuscule, 1 chiffre, 1 symbole" })
  @IsString()
  @MinLength(10)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&\-_#]).{10,}$/, {
    message:
      "Le mot de passe doit contenir au moins 10 caractères, une majuscule, un chiffre et un symbole",
  })
  newPassword: string;
}

export class OtpSendDto {
  @ApiProperty({ example: "+221XXXXXXXXX" })
  @IsString()
  phone: string;
}

export class OtpVerifyDto {
  @ApiProperty({ example: "+221XXXXXXXXX" })
  @IsString()
  phone: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  code: string;
}

export class OtpResponseDto {
  success: boolean;
  expiresIn?: number;
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
