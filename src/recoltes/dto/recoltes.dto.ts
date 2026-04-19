import {
  IsString,
  IsNumber,
  IsOptional,
  IsMongoId,
  IsDate,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateRecolteDto {
  @ApiProperty() @IsMongoId() parcelleId: string;
  @ApiProperty() @IsMongoId() technicianId: string;
  @ApiProperty() @IsDate() dateRecolte: Date;
  @ApiProperty() @IsNumber() quantiteRecoltee: number;
  @ApiProperty() @IsNumber() superficie: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() pertesPostRecolte?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() prixVente?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() qualite?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observations?: string;
}

export class UpdateRecolteDto {
  @ApiPropertyOptional() @IsOptional() @IsDate() dateRecolte?: Date;
  @ApiPropertyOptional() @IsOptional() @IsNumber() quantiteRecoltee?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() superficie?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() pertesPostRecolte?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() prixVente?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() qualite?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observations?: string;
}
