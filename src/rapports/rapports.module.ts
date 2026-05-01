import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RapportsController } from "./rapports.controller";
import { RapportsService } from "./rapports.service";
import { Visite } from "../visites/entities/visite.entity";
import { Tache } from "../taches/entities/tache.entity";
import { Recolte } from "../recoltes/entities/recolte.entity";
import { Parcelle } from "../parcelles/entities/parcelle.entity";
import { Mouvement } from "../intrants/entities/mouvement.entity";
import { Intrant } from "../intrants/entities/intrant.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Visite, Tache, Recolte, Parcelle, Mouvement, Intrant]),
  ],
  controllers: [RapportsController],
  providers: [RapportsService],
  exports: [RapportsService],
})
export class RapportsModule {}
