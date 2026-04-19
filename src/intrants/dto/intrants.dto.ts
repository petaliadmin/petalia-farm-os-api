import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsMongoId,
  IsDate,
  Min,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateIntrantDto {
  @ApiProperty()
  @IsString()
  nom: string;

  @ApiProperty({ enum: ["Engrais", "Pesticide", "Semence", "Autre"] })
  @IsEnum(["Engrais", "Pesticide", "Semence", "Autre"])
  type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  marque?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  unite: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  quantiteStock: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  seuilAlerte?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  prixUnitaire?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  dateExpiration?: Date;

  @ApiPropertyOptional()
  @IsMongoId()
  @IsOptional()
  organisationId?: string;
}

export class UpdateIntrantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  marque?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  quantiteStock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  seuilAlerte?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  prixUnitaire?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  dateExpiration?: Date;
}

export class CreateMouvementDto {
  @ApiProperty({ enum: ["entree", "sortie"] })
  @IsEnum(["entree", "sortie"])
  type: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  quantite: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  date?: Date;

  @ApiPropertyOptional()
  @IsMongoId()
  @IsOptional()
  parcelleId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  motif?: string;

  @ApiPropertyOptional()
  @IsMongoId()
  @IsOptional()
  operateurId?: string;
}
