import { NestFactory } from "@nestjs/core";
import { ValidationPipe, INestApplication } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ExpressAdapter } from "@nestjs/platform-express";
import { Logger as PinoLogger } from "nestjs-pino";
import * as express from "express";
import { AppModule } from "./app.module";
import { setupPublicApiDocs } from "./public-api/openapi";

const SWAGGER_CDN = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14";

export async function configureApp(app: INestApplication): Promise<void> {
  app.setGlobalPrefix("api");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Site vitrine (formulaires, espace développeur) + front local par défaut
  const allowedOrigins = (
    process.env.CORS_ORIGIN ||
    "http://localhost:4200,https://www.petalia.sn,https://petalia.sn,https://developers.petalia.sn"
  )
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin non autorisée — ${origin}`));
      }
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: [
      "Authorization",
      "X-App-Version",
      "X-Device-Key",
      "Accept-Language",
      "Content-Type",
      "Idempotency-Key",
      "Petalia-Version",
      "X-API-Key",
      "X-Request-Id",
    ],
    exposedHeaders: [
      "Request-Id",
      "Petalia-Version",
      "Idempotent-Replayed",
      "X-RateLimit-Limit-Hour",
      "X-RateLimit-Remaining-Hour",
      "X-RateLimit-Limit-Month",
      "X-RateLimit-Remaining-Month",
    ],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Petalia AgroAssist API")
    .setVersion("2.0.0")
    .setDescription("Backend API for Petalia Farm OS - Compatible Web & Mobile")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  setupPublicApiDocs(app, SWAGGER_CDN);
  SwaggerModule.setup("api/docs", app, document, {
    customCssUrl: `${SWAGGER_CDN}/swagger-ui.css`,
    customJs: [
      `${SWAGGER_CDN}/swagger-ui-bundle.js`,
      `${SWAGGER_CDN}/swagger-ui-standalone-preset.js`,
    ],
  });
}

export async function createApp(
  expressInstance?: express.Express,
): Promise<INestApplication> {
  const app = expressInstance
    ? await NestFactory.create(AppModule, new ExpressAdapter(expressInstance))
    : await NestFactory.create(AppModule);
  await configureApp(app);
  return app;
}

async function bootstrap() {
  const app = await createApp();
  const port = process.env.PORT || 3000;
  const logger = app.get(PinoLogger);
  await app.listen(port);
  logger.log(`🐝 Petalia API running on port ${port}`);
}

if (require.main === module) {
  bootstrap();
}
