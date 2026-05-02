import { NestFactory } from "@nestjs/core";
import { Logger as PinoLogger } from "nestjs-pino";
import { AppModule } from "./app.module";

/**
 * Standalone worker process — boots the same Nest application context as the
 * HTTP server but does NOT listen on an HTTP port. All Bull processors,
 * cron jobs, and background services start automatically because they are
 * declared with @Processor / @Cron decorators inside their respective modules.
 *
 * Why a separate process:
 *   - CPU-isolated from API request handling (PDF / NDVI work won't slow /api)
 *   - Scaled independently (more worker replicas during ingestion bursts)
 *   - Restartable without dropping HTTP connections
 *
 * Run via:  node dist/worker.js
 */
async function bootstrapWorker() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(PinoLogger);
  app.useLogger(logger);

  const shutdown = async (signal: string) => {
    logger.log(`Worker received ${signal} — closing gracefully`);
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  app.enableShutdownHooks();
  logger.log("🐝 Petalia worker process online (Bull + cron + processors)");
}

if (require.main === module) {
  bootstrapWorker().catch((err) => {
    console.error("Worker failed to start:", err);
    process.exit(1);
  });
}
