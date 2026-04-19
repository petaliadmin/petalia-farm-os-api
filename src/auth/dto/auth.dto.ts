import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsNotEmpty,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "motdepasse" })
  @IsString()
  @MinLength(6)
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

  @ApiProperty()
  @IsString()
  @MinLength(6)
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
  token: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
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
