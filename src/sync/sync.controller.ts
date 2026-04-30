import { Controller, Get, Post, Body, Query } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SyncService } from "./sync.service";

@ApiTags("Sync (Flutter)")
@Controller("v1")
export class SyncController {
  constructor(private syncService: SyncService) {}

  @Get("agro_rules")
  @ApiOperation({ summary: "Get agro rules for Flutter sync" })
  getAgroRules(@Query("since") since?: string) {
    return this.syncService.getAgroRules(since);
  }

  @Post("expert_requests")
  @ApiOperation({ summary: "Submit expert request from Flutter" })
  createExpertRequest(@Body() data: any) {
    return this.syncService.createExpertRequest(data);
  }

  @Post("sync/push")
  @ApiOperation({ summary: "Push offline actions from Flutter" })
  pushSync(@Body() body: { actions: any[] }) {
    return this.syncService.pushSync(body.actions);
  }

  @Get("sync/pull")
  @ApiOperation({ summary: "Pull data for Flutter sync" })
  pullSync(
    @Query("since") since?: string,
    @Query("resources") resources?: string,
  ) {
    return this.syncService.pullSync(
      since || "",
      resources || "parcels,agro_rules",
    );
  }

  @Get("sync/status")
  @ApiOperation({ summary: "Get sync status" })
  getSyncStatus() {
    return this.syncService.getSyncStatus();
  }
}
