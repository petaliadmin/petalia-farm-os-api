import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisitesController } from './visites.controller';
import { VisitesService } from './visites.service';
import { Visite } from './entities/visite.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Visite])],
  controllers: [VisitesController],
  providers: [VisitesService],
  exports: [VisitesService],
})
export class VisitesModule {}
