import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BillingModule } from "../billing/billing.module";
import { Organisation } from "../organisations/entities/organisation.entity";
import { ApiKey } from "../partner/entities/api-key.entity";
import { PartnerModule } from "../partner/partner.module";
import { DeveloperAuthGuard } from "./developer-auth.guard";
import {
  DeveloperAuthController,
  DeveloperController,
} from "./developer.controller";
import { DeveloperService } from "./developer.service";
import { DeveloperAccount } from "./entities/developer-account.entity";

/** Espace développeur en libre-service (developers.petalia.sn). */
@Module({
  imports: [
    TypeOrmModule.forFeature([DeveloperAccount, Organisation, ApiKey]),
    // Secret distinct de celui de la plateforme : un jeton développeur n'y ouvre rien
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const base =
          config.get<string>("DEVELOPER_JWT_SECRET") ??
          config.get<string>("JWT_SECRET");
        if (!base) {
          throw new Error("DEVELOPER_JWT_SECRET ou JWT_SECRET requis");
        }
        return {
          secret:
            config.get<string>("DEVELOPER_JWT_SECRET") ?? `${base}:developer`,
        };
      },
    }),
    PartnerModule,
    BillingModule,
  ],
  controllers: [DeveloperAuthController, DeveloperController],
  providers: [DeveloperService, DeveloperAuthGuard],
})
export class DeveloperModule {}
