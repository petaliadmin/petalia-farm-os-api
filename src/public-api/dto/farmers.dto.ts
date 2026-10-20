import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from "@nestjs/swagger";
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { ListQueryDto } from "../common/pagination";
import { CHANNELS, Channel } from "../public-api.constants";
import { GEOJSON_POINT_SCHEMA, IsMetadata, LANGUAGES } from "./common.dto";

export class CreateFarmerDto {
  @ApiProperty({
    example: "+221771234567",
    description: "Identité du producteur. Les numéros locaux reçoivent +221.",
  })
  @IsString()
  @MaxLength(24)
  phone: string;

  @ApiProperty({ example: "Awa" })
  @IsString()
  @Length(1, 80)
  first_name: string;

  @ApiProperty({ example: "Ndiaye" })
  @IsString()
  @Length(1, 80)
  last_name: string;

  @ApiPropertyOptional({ enum: ["female", "male"] })
  @IsOptional()
  @IsIn(["female", "male"])
  gender?: "female" | "male";

  @ApiPropertyOptional({ example: 1984 })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  birth_year?: number;

  @ApiPropertyOptional({ enum: LANGUAGES, default: "fr" })
  @IsOptional()
  @IsIn(LANGUAGES)
  preferred_language?: string;

  @ApiPropertyOptional({ enum: CHANNELS, default: "sms" })
  @IsOptional()
  @IsIn(CHANNELS)
  preferred_channel?: Channel;

  @ApiPropertyOptional({ example: "Mboro" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  locality?: string;

  @ApiPropertyOptional({ example: "Thiès" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  region?: string;

  @ApiPropertyOptional({ example: "SN", description: "ISO 3166-1 alpha-2" })
  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  country?: string;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: { type: "string" },
  })
  @IsOptional()
  @IsMetadata()
  metadata?: Record<string, string>;
}

export class UpdateFarmerDto extends PartialType(
  OmitType(CreateFarmerDto, ["phone"] as const),
) {}

export class ListFarmersQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ description: "Recherche exacte par téléphone" })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class CreateFarmDto {
  @ApiProperty({ example: "fmr_4fT0b2…" })
  @IsString()
  farmer: string;

  @ApiProperty({ example: "Exploitation Ndiaye – Mboro" })
  @IsString()
  @Length(1, 120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  locality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  region?: string;

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

export class UpdateFarmDto extends PartialType(
  OmitType(CreateFarmDto, ["farmer"] as const),
) {}

export class ListFarmsQueryDto extends ListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  farmer?: string;
}
