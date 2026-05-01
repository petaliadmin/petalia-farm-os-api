import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bull";
import { RapportsController } from "./rapports.controller";
import { RapportsService } from "./rapports.service";
import { RapportsProcessor } from "./rapports.processor";
import { QUEUE_NAMES } from "../common/queues";
import { Visite } from "../visites/entities/visite.entity";
import { Tache } from "../taches/entities/tache.entity";
import { Recolte } from "../recoltes/entities/recolte.entity";
import { Parcelle } from "../parcelles/entities/parcelle.entity";
import { Mouvement } from "../intrants/entities/mouvement.entity";
import { Intrant } from "../intrants/entities/intrant.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Visite,
      Tache,
      Recolte,
      Parcelle,
      Mouvement,
      Intrant,
    ]),
    BullModule.registerQueue({ name: QUEUE_NAMES.PDF }),
  ],
  controllers: [RapportsController],
  providers: [RapportsService, RapportsProcessor],
  exports: [RapportsService],
})
export class RapportsModule {}
