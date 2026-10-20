import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
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
  ValidateNested,
} from "class-validator";
import {
  WEBSITE_REQUEST_STATUSES,
  WEBSITE_REQUEST_TYPES,
  WebsiteRequestStatus,
  WebsiteRequestType,
} from "../entities/website-request.entity";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

const PHONE = /^\+?[0-9\s-]{8,20}$/;

/** Champs communs aux formulaires du site. */
class WebsiteFormDto {
  @ApiProperty({ example: "Awa Ndiaye" })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: "+221 77 123 45 67" })
  @Transform(trim)
  @Matches(PHONE, { message: "Numéro de téléphone invalide" })
  phone: string;

  @ApiPropertyOptional({ example: "awa@exemple.sn" })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() || undefined : value,
  )
  @IsEmail({}, { message: "Adresse e-mail invalide" })
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ description: "Page d'origine, ex. /boutique" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sourcePage?: string;

  /** Champ piège invisible pour les humains : rempli = robot. */
  @ApiPropertyOptional({ description: "Laisser vide (anti-spam)" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;
}

export class ContactRequestDto extends WebsiteFormDto {
  @ApiProperty({ example: "Bonjour, je souhaite équiper 5 ha de maraîchage." })
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  message: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  farmSize?: string;
}

export class DemoRequestDto extends WebsiteFormDto {
  @ApiProperty({ example: "5–20 ha" })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  farmSize: string;

  @ApiPropertyOptional({ example: "Riz" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  culture?: string;

  @ApiPropertyOptional({ example: "Semaine prochaine" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  availability?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  message?: string;
}

export class OrderLineDto {
  @ApiProperty({ example: "capteur-humidite-sol-lorawan" })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  productId: string;

  @ApiProperty({ example: "Capteur d'humidité du sol LoRaWAN" })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity: number;

  @ApiProperty({ example: 45000, description: "Prix unitaire affiché (FCFA)" })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  unitPriceFcfa: number;
}

export class OrderRequestDto extends WebsiteFormDto {
  @ApiProperty({ type: [OrderLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  lines: OrderLineDto[];

  @ApiPropertyOptional({ example: "Mboro, Thiès" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  deliveryLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  message?: string;
}

export class ListWebsiteRequestsQueryDto {
  @ApiPropertyOptional({ enum: WEBSITE_REQUEST_TYPES })
  @IsOptional()
  @IsIn(WEBSITE_REQUEST_TYPES)
  type?: WebsiteRequestType;

  @ApiPropertyOptional({ enum: WEBSITE_REQUEST_STATUSES })
  @IsOptional()
  @IsIn(WEBSITE_REQUEST_STATUSES)
  status?: WebsiteRequestStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class UpdateWebsiteRequestDto {
  @ApiPropertyOptional({ enum: WEBSITE_REQUEST_STATUSES })
  @IsOptional()
  @IsIn(WEBSITE_REQUEST_STATUSES)
  status?: WebsiteRequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

/** Réponse des formulaires publics (contrat attendu par le site). */
export interface WebsiteFormResponse {
  success: true;
  message: string;
  /** Identifiant de la demande (contactId conservé pour compatibilité avec le site) */
  id: string;
  contactId: string;
}
