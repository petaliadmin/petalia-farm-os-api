import {
  IsString,
  IsOptional,
  IsEnum,
  IsDate,
  IsNumber,
  IsMongoId,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateCampagneDto {
  @ApiProperty() @IsString() nom: string;
  @ApiProperty({
    enum: ["hivernage", "contre_saison_froide", "contre_saison_chaude"],
  })
  @IsEnum(["hivernage", "contre_saison_froide", "contre_saison_chaude"])
  type: string;
  @ApiProperty() @IsDate() dateDebut: Date;
  @ApiPropertyOptional() @IsOptional() @IsNumber() objectifRendement?: number;
  @ApiPropertyOptional() @IsOptional() @IsMongoId() organisationId?: string;
}

export class UpdateCampagneDto {
  @ApiPropertyOptional() @IsOptional() @IsString() nom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDate() dateFin?: Date;
  @ApiPropertyOptional() @IsOptional() @IsNumber() progressionPct?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() objectifRendement?: number;
}

export class ClotureCampagneDto {
  @ApiPropertyOptional() @IsOptional() @IsString() dateFin?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() rendementFinal?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() observationsCloture?: string;
}
