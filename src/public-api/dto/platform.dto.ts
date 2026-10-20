import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { ListQueryDto } from "../common/pagination";
import {
  CHANNELS,
  Channel,
  CONSENTABLE_SCOPES,
  EVENT_TYPES,
} from "../public-api.constants";
import { IsMetadata, LANGUAGES } from "./common.dto";

export class CreateConsentDto {
  @ApiPropertyOptional({
    example: "fmr_4fT0b2…",
    description: "farmer ou farmer_phone",
  })
  @IsOptional()
  @IsString()
  farmer?: string;

  @ApiPropertyOptional({ example: "+221771234567" })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  farmer_phone?: string;

  @ApiProperty({
    enum: CONSENTABLE_SCOPES,
    isArray: true,
    example: ["parcels:read"],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  scopes: string[];

  @ApiProperty({
    example: "Évaluer votre éligibilité à un crédit intrants",
    description: "Finalité lue au producteur dans le SMS de confirmation.",
  })
  @IsString()
  @Length(10, 160)
  purpose: string;

  @ApiPropertyOptional({
    description: "Fin du consentement (défaut : 12 mois)",
  })
  @IsOptional()
  @IsDateString()
  expires_at?: string;
}

export class ConfirmConsentDto {
  @ApiProperty({
    example: "482913",
    description: "Code reçu par SMS par le producteur",
  })
  @Matches(/^\d{6}$/)
  code: string;
}

export class ListConsentsQueryDto extends ListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  farmer?: string;

  @ApiPropertyOptional({
    enum: ["pending", "active", "revoked", "expired", "rejected"],
  })
  @IsOptional()
  @IsIn(["pending", "active", "revoked", "expired", "rejected"])
  status?: string;
}

export class CreateWebhookEndpointDto {
  @ApiProperty({ example: "https://example.sn/hooks/petalia" })
  @IsUrl({
    protocols: ["https", "http"],
    require_protocol: true,
    require_tld: false,
  })
  @MaxLength(2048)
  url: string;

  @ApiProperty({
    enum: [...EVENT_TYPES, "*"],
    isArray: true,
    example: ["observation.created"],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(EVENT_TYPES.length)
  @IsIn([...EVENT_TYPES, "*"], { each: true })
  enabled_events: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: { type: "string" },
  })
  @IsOptional()
  @IsMetadata()
  metadata?: Record<string, string>;
}

export class UpdateWebhookEndpointDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({
    protocols: ["https", "http"],
    require_protocol: true,
    require_tld: false,
  })
  @MaxLength(2048)
  url?: string;

  @ApiPropertyOptional({ enum: [...EVENT_TYPES, "*"], isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn([...EVENT_TYPES, "*"], { each: true })
  enabled_events?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ enum: ["enabled", "disabled"] })
  @IsOptional()
  @IsIn(["enabled", "disabled"])
  status?: "enabled" | "disabled";
}

export class ListEventsQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: EVENT_TYPES })
  @IsOptional()
  @IsIn(EVENT_TYPES)
  type?: string;
}

export class CreateNotificationDto {
  @ApiPropertyOptional({
    example: "fmr_4fT0b2…",
    description: "Destinataire (prioritaire sur to)",
  })
  @IsOptional()
  @IsString()
  farmer?: string;

  @ApiPropertyOptional({
    example: "+221771234567",
    description:
      "Numéro libre — uniquement pour l'organisation, sans données producteur.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  to?: string;

  @ApiPropertyOptional({
    enum: CHANNELS,
    description: "Défaut : canal préféré du producteur, sinon sms",
  })
  @IsOptional()
  @IsIn(CHANNELS)
  channel?: Channel;

  @ApiProperty({
    example: "Pluie de 25 mm prévue demain : reportez l'irrigation.",
  })
  @IsString()
  @Length(1, 640)
  body: string;

  @ApiPropertyOptional({
    enum: LANGUAGES,
    description: "Défaut : langue du producteur",
  })
  @IsOptional()
  @IsIn(LANGUAGES)
  language?: string;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: { type: "string" },
  })
  @IsOptional()
  @IsMetadata()
  metadata?: Record<string, string>;
}

export class OAuthTokenDto {
  @ApiProperty({ enum: ["client_credentials"] })
  @IsString()
  grant_type: string;

  @ApiPropertyOptional({
    example: "key_5ZbQ…",
    description: "Ou en HTTP Basic",
  })
  @IsOptional()
  @IsString()
  client_id?: string;

  @ApiPropertyOptional({
    example: "sk_live_…",
    description: "Ou en HTTP Basic",
  })
  @IsOptional()
  @IsString()
  client_secret?: string;

  @ApiPropertyOptional({ example: "parcels:read observations:read" })
  @IsOptional()
  @IsString()
  scope?: string;
}

export const SYNC_RESOURCES = [
  "farmers",
  "farms",
  "parcels",
  "crop_cycles",
  "devices",
] as const;
export type SyncResource = (typeof SYNC_RESOURCES)[number];

export class SyncQueryDto {
  @ApiPropertyOptional({
    description:
      "Curseur renvoyé par l'appel précédent (absent = synchro complète)",
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: `Liste séparée par des virgules parmi : ${SYNC_RESOURCES.join(", ")}`,
    example: "farmers,parcels",
  })
  @IsOptional()
  @IsString()
  resources?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 500, default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class WeatherQueryDto {
  @ApiProperty({ example: 14.94 })
  @Type(() => Number)
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: -16.93 })
  @Type(() => Number)
  @Min(-180)
  @Max(180)
  lng: number;
}
