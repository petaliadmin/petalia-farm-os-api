import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsMongoId,
  IsDate,
  IsArray,
  IsObject,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateVisiteDto {
  @ApiProperty()
  @IsMongoId()
  parcelleId: string;

  @ApiProperty()
  @IsMongoId()
  technicianId: string;

  @ApiProperty()
  @IsDate()
  date: Date;

  @ApiPropertyOptional({
    enum: ["planifiee", "en_cours", "completee", "annulee"],
  })
  @IsOptional()
  @IsEnum(["planifiee", "en_cours", "completee", "annulee"])
  statut?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  dureeMinutes?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  objectif?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  observations?: string;

  @ApiPropertyOptional({
    enum: ["normale", "stress", "maladie", "ravageur", "carence", "autre"],
  })
  @IsOptional()
  @IsEnum(["normale", "stress", "maladie", "ravageur", "carence", "autre"])
  etatGeneral?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  observationsDetaillees?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  recommandations?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  prochainAction?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  gpsLocation?: { type: "Point"; coordinates: [number, number] };

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  photos?: string[];

  @ApiPropertyOptional()
  @IsMongoId()
  @IsOptional()
  campagneId?: string;
}

export class UpdateVisiteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  date?: Date;

  @ApiPropertyOptional({
    enum: ["planifiee", "en_cours", "completee", "annulee"],
  })
  @IsOptional()
  @IsEnum(["planifiee", "en_cours", "completee", "annulee"])
  statut?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  dureeMinutes?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  objectif?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  observations?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  etatGeneral?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  observationsDetaillees?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  recommandations?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  prochainAction?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  photos?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  rapport?: string;
}
