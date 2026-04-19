import {
  IsString,
  IsOptional,
  IsEnum,
  IsMongoId,
  IsDate,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateTacheDto {
  @ApiProperty()
  @IsString()
  titre: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsMongoId()
  @IsOptional()
  parcelleId?: string;

  @ApiPropertyOptional()
  @IsMongoId()
  @IsOptional()
  assigneAId?: string;

  @ApiPropertyOptional()
  @IsMongoId()
  @IsOptional()
  creeParId?: string;

  @ApiPropertyOptional()
  @IsMongoId()
  @IsOptional()
  campagneId?: string;

  @ApiPropertyOptional({ enum: ["basse", "normale", "haute", "urgente"] })
  @IsOptional()
  @IsEnum(["basse", "normale", "haute", "urgente"])
  priorite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  datePlanifiee?: Date;
}

export class UpdateTacheDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  titre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  parcelleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  assigneAId?: string;

  @ApiPropertyOptional({ enum: ["todo", "en_cours", "done", "reporte"] })
  @IsOptional()
  @IsEnum(["todo", "en_cours", "done", "reporte"])
  statut?: string;

  @ApiPropertyOptional({ enum: ["basse", "normale", "haute", "urgente"] })
  @IsOptional()
  @IsEnum(["basse", "normale", "haute", "urgente"])
  priorite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  datePlanifiee?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  dateFin?: Date;
}
