import { IsEmail, IsString, MinLength, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

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
