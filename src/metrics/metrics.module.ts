import {
  Global,
  MiddlewareConsumer,
  Module,
  NestModule,
} from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { QUEUE_NAMES } from "../common/queues";
import { MetricsService } from "./metrics.service";
import { MetricsController } from "./metrics.controller";
import { MetricsMiddleware } from "./metrics.middleware";
import { MetricsAuthGuard } from "./metrics-auth.guard";
import { QueueMetricsCollector } from "./queue-metrics.collector";

@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.NDVI },
      { name: QUEUE_NAMES.PDF },
      { name: QUEUE_NAMES.SMS },
      { name: QUEUE_NAMES.ALERTES },
      { name: QUEUE_NAMES.WHATSAPP },
    ),
  ],
  controllers: [MetricsController],
  providers: [
    MetricsService,
    MetricsAuthGuard,
    QueueMetricsCollector,
  ],
  exports: [MetricsService],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes("*");
  }
}
