import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Organisation } from "./entities/organisation.entity";
import { OrganisationsController } from "./organisations.controller";
import { OrganisationsService } from "./organisations.service";

@Module({
  imports: [TypeOrmModule.forFeature([Organisation])],
  controllers: [OrganisationsController],
  providers: [OrganisationsService],
  exports: [OrganisationsService],
})
export class OrganisationsModule {}
