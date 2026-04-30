import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { AgroRule } from './entities/agro-rule.entity';
import { ExpertRequest } from './entities/expert-request.entity';
import { Parcelle } from '../parcelles/entities/parcelle.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AgroRule, ExpertRequest, Parcelle])],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
