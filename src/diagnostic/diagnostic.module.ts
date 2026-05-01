import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DiagnosticController } from "./diagnostic.controller";
import { DiagnosticService } from "./diagnostic.service";
import { ClaudeVisionClient } from "./claude-vision.client";
import { Diagnostic } from "./entities/diagnostic.entity";
import { Parcelle } from "../parcelles/entities/parcelle.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Diagnostic, Parcelle])],
  controllers: [DiagnosticController],
  providers: [DiagnosticService, ClaudeVisionClient],
  exports: [DiagnosticService],
})
export class DiagnosticModule {}
