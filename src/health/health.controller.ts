import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { SkipThrottle } from "@nestjs/throttler";

@ApiTags("Health")
@Controller("health")
@SkipThrottle()
export class HealthController {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: "Vérification de santé de l'API" })
  async check() {
    const dbOk = this.dataSource.isInitialized;

    return {
      status: dbOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      services: {
        api: "ok",
        database: dbOk ? "ok" : "error",
      },
    };
  }
}
