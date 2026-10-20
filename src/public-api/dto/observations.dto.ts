import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { ListQueryDto } from "../common/pagination";
import { OBSERVED_PROPERTIES } from "../common/vocabulary";
import { GEOJSON_POINT_SCHEMA, IsMetadata } from "./common.dto";

const DEVICE_TYPES = ["sensor", "gateway", "weather_station", "drone"] as const;
const SOURCES = ["sensor", "satellite", "manual", "drone"] as const;
const QUALITIES = ["raw", "validated", "suspect", "rejected"] as const;
const PROPERTIES = Object.keys(OBSERVED_PROPERTIES);

export class CreateDeviceDto {
  @ApiProperty({ enum: DEVICE_TYPES })
  @IsIn(DEVICE_TYPES)
  type: (typeof DEVICE_TYPES)[number];

  @ApiProperty({ example: "dragino", description: "dragino, ecowitt, dji…" })
  @IsString()
  @Length(1, 40)
  manufacturer: string;

  @ApiPropertyOptional({ example: "LSE01" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  serial_number?: string;

  @ApiPropertyOptional({
    example: "A84041000181C2E1",
    description: "LoRaWAN DevEUI",
  })
  @IsOptional()
  @Matches(/^[0-9A-Fa-f]{16}$/)
  dev_eui?: string;

  @ApiProperty({ example: "Sonde sol – parcelle nord" })
  @IsString()
  @Length(1, 120)
  name: string;

  @ApiPropertyOptional({ example: "prc_2Kx9…" })
  @IsOptional()
  @IsString()
  parcel?: string;

  @ApiPropertyOptional(GEOJSON_POINT_SCHEMA)
  @IsOptional()
  @IsObject()
  location?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: { type: "string" },
  })
  @IsOptional()
  @IsMetadata()
  metadata?: Record<string, string>;
}

export class UpdateDeviceDto extends PartialType(
  OmitType(CreateDeviceDto, ["type", "dev_eui"] as const),
) {
  @ApiPropertyOptional({ enum: ["active", "inactive"] })
  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: "active" | "inactive";
}

export class ListDevicesQueryDto extends ListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parcel?: string;

  @ApiPropertyOptional({ enum: DEVICE_TYPES })
  @IsOptional()
  @IsIn(DEVICE_TYPES)
  type?: string;
}

export class CreateObservationDto {
  @ApiPropertyOptional({ example: "prc_8Hq…" })
  @IsOptional()
  @IsString()
  parcel?: string;

  @ApiPropertyOptional({ example: "dev_3Rt…" })
  @IsOptional()
  @IsString()
  device?: string;

  @ApiPropertyOptional({
    enum: SOURCES,
    description: "Défaut : sensor si device est fourni, sinon manual",
  })
  @IsOptional()
  @IsIn(SOURCES)
  source_type?: (typeof SOURCES)[number];

  @ApiProperty({ enum: PROPERTIES, example: "soil_moisture" })
  @IsString()
  property: string;

  @ApiProperty({ example: 23.4 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  value: number;

  @ApiProperty({ example: "%", description: "Unité explicite, obligatoire" })
  @IsString()
  @MaxLength(16)
  unit: string;

  @ApiProperty({ example: "2026-10-19T06:00:00Z" })
  @IsDateString({ strict: true })
  observed_at: string;

  @ApiPropertyOptional({ enum: QUALITIES, default: "raw" })
  @IsOptional()
  @IsIn(QUALITIES)
  quality?: (typeof QUALITIES)[number];

  @ApiPropertyOptional(GEOJSON_POINT_SCHEMA)
  @IsOptional()
  @IsObject()
  location?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: { type: "string" },
  })
  @IsOptional()
  @IsMetadata()
  metadata?: Record<string, string>;
}

export class BatchObservationsDto {
  @ApiProperty({ type: [CreateObservationDto], maxItems: 1000 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => CreateObservationDto)
  observations: CreateObservationDto[];
}

export class ListObservationsQueryDto extends ListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parcel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  device?: string;

  @ApiPropertyOptional({ enum: PROPERTIES })
  @IsOptional()
  @IsString()
  property?: string;

  @ApiPropertyOptional({ enum: SOURCES })
  @IsOptional()
  @IsIn(SOURCES)
  source_type?: string;

  @ApiPropertyOptional({ example: "2026-10-01T00:00:00Z" })
  @IsOptional()
  @IsDateString()
  observed_after?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  observed_before?: string;
}
