import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { ListQueryDto } from "../common/pagination";
import { CROP_CODES, CropCode } from "../common/vocabulary";
import { GEOJSON_POLYGON_SCHEMA, IsMetadata } from "./common.dto";

const TENURES = ["owned", "borrowed", "rented", "communal"] as const;

export class CreateParcelDto {
  @ApiProperty({ example: "Champ de l'oignon nord" })
  @IsString()
  @Length(1, 120)
  name: string;

  @ApiPropertyOptional({ description: "Code métier unique ; généré sinon." })
  @IsOptional()
  @IsString()
  @Length(2, 40)
  code?: string;

  @ApiPropertyOptional({ example: "fmr_4fT0b2…" })
  @IsOptional()
  @IsString()
  farmer?: string;

  @ApiPropertyOptional({ example: "farm_9Lk…" })
  @IsOptional()
  @IsString()
  farm?: string;

  @ApiProperty({
    ...GEOJSON_POLYGON_SCHEMA,
    description: `${GEOJSON_POLYGON_SCHEMA.description} La surface (ha) est calculée.`,
  })
  @IsObject()
  geometry: Record<string, unknown>;

  @ApiPropertyOptional({ example: "Thiès" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  region?: string;

  @ApiPropertyOptional({ example: "Mboro" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  locality?: string;

  @ApiPropertyOptional({ example: "Niayes" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  agroecological_zone?: string;

  @ApiPropertyOptional({ example: "dior" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  soil_type?: string;

  @ApiPropertyOptional({ example: "puits" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  water_source?: string;

  @ApiPropertyOptional({ enum: TENURES })
  @IsOptional()
  @IsIn(TENURES)
  land_tenure?: (typeof TENURES)[number];

  @ApiPropertyOptional({ enum: CROP_CODES, description: "Culture en place" })
  @IsOptional()
  @IsIn(CROP_CODES)
  crop?: CropCode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  variety?: string;

  @ApiPropertyOptional({ example: "2026-07-15" })
  @IsOptional()
  @IsDateString()
  sown_on?: string;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: { type: "string" },
  })
  @IsOptional()
  @IsMetadata()
  metadata?: Record<string, string>;
}

export class UpdateParcelDto extends PartialType(CreateParcelDto) {}

export class ListParcelsQueryDto extends ListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  farmer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  farm?: string;

  @ApiPropertyOptional({ enum: CROP_CODES })
  @IsOptional()
  @IsIn(CROP_CODES)
  crop?: CropCode;

  @ApiPropertyOptional({
    description: "minLng,minLat,maxLng,maxLat",
    example: "-17.2,14.6,-16.8,15.1",
  })
  @IsOptional()
  @IsString()
  bbox?: string;

  @ApiPropertyOptional({
    description: "lat,lng — combiné à radius (m)",
    example: "14.94,-16.93",
  })
  @IsOptional()
  @IsString()
  near?: string;

  @ApiPropertyOptional({
    description: "Rayon en mètres pour near (défaut 1000)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  radius?: number;

  @ApiPropertyOptional({
    description: "Géométrie GeoJSON (Point ou Polygon) encodée en JSON",
  })
  @IsOptional()
  @IsString()
  intersects?: string;

  @ApiPropertyOptional({
    enum: ["json", "geojson"],
    description: "geojson = FeatureCollection",
  })
  @IsOptional()
  @IsIn(["json", "geojson"])
  format?: "json" | "geojson";
}

export class QuantityKgDto {
  @ApiProperty({ example: 1850 })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiProperty({ enum: ["kg"] })
  @IsIn(["kg"])
  unit: "kg";
}

const SEASON_CODES = ["rainy", "cold_dry", "hot_dry"] as const;
const CYCLE_STATUSES = ["planned", "active", "harvested", "failed"] as const;

export class CreateCropCycleDto {
  @ApiProperty({ example: "prc_2Kx9…" })
  @IsString()
  parcel: string;

  @ApiProperty({ enum: CROP_CODES })
  @IsIn(CROP_CODES)
  crop: CropCode;

  @ApiPropertyOptional({ example: "Violet de Galmi" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  variety?: string;

  @ApiProperty({
    enum: SEASON_CODES,
    description:
      "rainy = hivernage, cold_dry / hot_dry = contre-saison froide / chaude",
  })
  @IsIn(SEASON_CODES)
  season: (typeof SEASON_CODES)[number];

  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  campaign_year: number;

  @ApiPropertyOptional({ enum: CYCLE_STATUSES, default: "planned" })
  @IsOptional()
  @IsIn(CYCLE_STATUSES)
  status?: (typeof CYCLE_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  sown_on?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expected_harvest_on?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  harvested_on?: string;

  @ApiPropertyOptional({ type: QuantityKgDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuantityKgDto)
  yield?: QuantityKgDto;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: { type: "string" },
  })
  @IsOptional()
  @IsMetadata()
  metadata?: Record<string, string>;
}

export class UpdateCropCycleDto extends PartialType(CreateCropCycleDto) {}

export class ListCropCyclesQueryDto extends ListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parcel?: string;

  @ApiPropertyOptional({ enum: CYCLE_STATUSES })
  @IsOptional()
  @IsIn(CYCLE_STATUSES)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  campaign_year?: number;
}
