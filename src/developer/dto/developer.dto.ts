import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  PUBLIC_SCOPES,
  PublicScope,
} from "../../public-api/public-api.constants";
import { ApiKeyKind, ApiKeyMode } from "../../partner/entities/api-key.entity";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
const lower = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

export class SignupDto {
  @ApiProperty({ example: "Awa Ndiaye" })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: "awa@agritech.sn" })
  @Transform(lower)
  @IsEmail({}, { message: "Adresse e-mail invalide" })
  @MaxLength(254)
  email: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10, { message: "Mot de passe : 10 caractères minimum" })
  @MaxLength(128)
  password: string;

  @ApiProperty({
    example: "+221771234567",
    description: "Reçoit le code de vérification par SMS",
  })
  @Transform(trim)
  @Matches(/^\+?[0-9\s-]{8,20}$/, { message: "Numéro de téléphone invalide" })
  phone: string;

  @ApiPropertyOptional({ example: "AgriTech SARL" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  company?: string;
}

export class VerifyDto {
  @ApiProperty()
  @Transform(lower)
  @IsEmail()
  email: string;

  @ApiProperty({ example: "123456" })
  @Matches(/^\d{6}$/, { message: "Le code contient 6 chiffres" })
  code: string;
}

export class ResendDto {
  @ApiProperty()
  @Transform(lower)
  @IsEmail()
  email: string;
}

export class LoginDto {
  @ApiProperty()
  @Transform(lower)
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MaxLength(128)
  password: string;
}

export class CreateDeveloperKeyDto {
  @ApiProperty({ example: "Serveur de recette" })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: ["test", "live"] })
  @IsIn(["test", "live"])
  mode: ApiKeyMode;

  @ApiPropertyOptional({ enum: ["secret", "publishable"], default: "secret" })
  @IsOptional()
  @IsIn(["secret", "publishable"])
  kind?: ApiKeyKind;

  @ApiPropertyOptional({
    description: "Validité en jours (plafonnée selon le mode et le tarif)",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  expiresInDays?: number;

  @ApiPropertyOptional({
    enum: PUBLIC_SCOPES,
    isArray: true,
    description: "Défaut : tous les scopes",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PUBLIC_SCOPES.length)
  @IsIn(PUBLIC_SCOPES, { each: true })
  scopes?: PublicScope[];
}
