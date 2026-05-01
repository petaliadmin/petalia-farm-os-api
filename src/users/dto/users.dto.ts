import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
  IsUUID,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateUserDto {
  @ApiPropertyOptional({ example: "user@example.com" })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: "+221XXXXXXXXX" })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    description: "Min 10 chars, 1 majuscule, 1 chiffre, 1 symbole",
  })
  @IsString()
  @MinLength(10)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&\-_#]).{10,}$/, {
    message:
      "Le mot de passe doit contenir au moins 10 caractères, une majuscule, un chiffre et un symbole",
  })
  password: string;

  @ApiProperty({ example: "Diallo" })
  @IsString()
  nom: string;

  @ApiProperty({ example: "Mamadou" })
  @IsString()
  prenom: string;

  @ApiProperty({
    enum: ["directeur", "superviseur", "technicien", "admin", "partenaire"],
  })
  @IsEnum(["directeur", "superviseur", "technicien", "admin", "partenaire"])
  role: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  organisationId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  equipeId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  avatar?: string;
}

export class UpdateUserDto {
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
  @IsEnum(["directeur", "superviseur", "technicien", "admin", "partenaire"])
  role?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  organisationId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  equipeId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  avatar?: string;

  @ApiPropertyOptional()
  @IsOptional()
  actif?: boolean;

  // Internal — not exposed via API, used by service layer
  passwordHash?: string;
}
