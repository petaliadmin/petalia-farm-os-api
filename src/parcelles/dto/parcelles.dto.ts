import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsMongoId,
  IsObject,
  Min,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateParcelleDto {
  @ApiProperty({ example: "P-2024-001" })
  @IsString()
  code: string;

  @ApiProperty({ example: "Parcelle Walo Nord" })
  @IsString()
  nom: string;

  @ApiProperty({ example: "Mamadou Diallo" })
  @IsString()
  producteurNom: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  exploitantNom?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  localite?: string;

  @ApiPropertyOptional({
    type: "object",
    example: {
      type: "Polygon",
      coordinates: [
        [
          [-16.9287, 14.7921],
          [-16.9265, 14.7921],
        ],
      ],
    },
  })
  @IsObject()
  boundary?: { type: "Polygon"; coordinates: number[][][] };

  @ApiProperty({ example: 5.5 })
  @IsNumber()
  @Min(0)
  superficie: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  zone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  typesSol?: string;

  @ApiPropertyOptional({
    enum: ["riz", "mais", "mil", "arachide", "oignon", "tomate", "autre"],
  })
  @IsOptional()
  @IsEnum(["riz", "mais", "mil", "arachide", "oignon", "tomate", "autre"])
  culture?: string;

  @ApiPropertyOptional({
    enum: [
      "semis",
      "levee",
      "vegetative",
      "tallage",
      "floraison",
      "fruiting",
      "maturation",
      "recolte",
    ],
  })
  @IsOptional()
  @IsEnum([
    "semis",
    "levee",
    "vegetative",
    "tallage",
    "floraison",
    "fruiting",
    "maturation",
    "recolte",
  ])
  stade?: string;

  @ApiPropertyOptional({
    enum: ["hivernage", "contre_saison_froide", "contre_saison_chaude"],
  })
  @IsOptional()
  @IsEnum(["hivernage", "contre_saison_froide", "contre_saison_chaude"])
  typeCampagne?: string;

  @ApiPropertyOptional()
  @IsOptional()
  dateSemis?: Date;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  variete?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  densite?: string;

  @ApiPropertyOptional({
    enum: ["riz", "mais", "mil", "arachide", "oignon", "tomate"],
  })
  @IsOptional()
  @IsEnum(["riz", "mais", "mil", "arachide", "oignon", "tomate"])
  culturePrecedente?: string;

  @ApiPropertyOptional({
    enum: ["riz", "mais", "mil", "arachide", "oignon", "tomate"],
  })
  @IsOptional()
  @IsEnum(["riz", "mais", "mil", "arachide", "oignon", "tomate"])
  rotationPrevue?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  typeSol?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  zoneAgroecologique?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  region?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sourceEau?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  modeAccesTerre?: string;

  @ApiPropertyOptional()
  @IsMongoId()
  @IsOptional()
  technicianId?: string;

  @ApiPropertyOptional()
  @IsMongoId()
  @IsOptional()
  organisationId?: string;

  @ApiPropertyOptional()
  @IsMongoId()
  @IsOptional()
  equipeId?: string;
}

export class UpdateParcelleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  producteurNom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  exploitantNom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  localite?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  boundary?: { type: "Polygon"; coordinates: number[][][] };

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  superficie?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  zone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  typesSol?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  culture?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stade?: string;

  @ApiPropertyOptional({ enum: ["sain", "attention", "urgent", "recolte"] })
  @IsOptional()
  @IsEnum(["sain", "attention", "urgent", "recolte"])
  statut?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  healthScore?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  rendmentPrecedent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  dateSemis?: Date;
}
