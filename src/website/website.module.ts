import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WebsiteRequest } from "./entities/website-request.entity";
import {
  WebsiteAdminController,
  WebsitePublicController,
} from "./website.controller";
import { WebsiteService } from "./website.service";

/** Site vitrine petalia.sn : formulaires de contact, démo et commande boutique. */
@Module({
  imports: [TypeOrmModule.forFeature([WebsiteRequest])],
  controllers: [WebsitePublicController, WebsiteAdminController],
  providers: [WebsiteService],
})
export class WebsiteModule {}
