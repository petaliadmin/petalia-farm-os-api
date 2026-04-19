import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
  IsMongoId,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateUserDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: "+221XXXXXXXXX" })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: "password123" })
  @IsString()
  @MinLength(6)
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
  @IsMongoId()
  @IsOptional()
  organisationId?: string;

  @ApiPropertyOptional()
  @IsMongoId()
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
  @IsMongoId()
  @IsOptional()
  organisationId?: string;

  @ApiPropertyOptional()
  @IsMongoId()
  @IsOptional()
  equipeId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  avatar?: string;

  @ApiPropertyOptional()
  @IsOptional()
  actif?: boolean;
}
