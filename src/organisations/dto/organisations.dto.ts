import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsUrl,
  IsNotEmpty,
  MinLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateOrganisationDto {
  @ApiProperty({ example: "Coopérative Delta Nord" })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  nom: string;

  @ApiPropertyOptional({ example: "CDN" })
  @IsOptional()
  @IsString()
  sigle?: string;

  @ApiProperty({
    enum: ["cooperative", "GIE", "ONG", "institution", "agro_dealer", "autre"],
  })
  @IsEnum(["cooperative", "GIE", "ONG", "institution", "agro_dealer", "autre"])
  type: string;

  @ApiPropertyOptional({ example: "SN" })
  @IsOptional()
  @IsString()
  pays?: string;

  @ApiPropertyOptional({ example: "Saint-Louis" })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adresse?: string;

  @ApiPropertyOptional({ example: "+221771234567" })
  @IsOptional()
  @IsString()
  telephone?: string;

  @ApiPropertyOptional({ example: "contact@coop-delta.sn" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: "https://cdn.example.com/logo.png" })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;
}

export class UpdateOrganisationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adresse?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telephone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  siteWeb?: string;
}
