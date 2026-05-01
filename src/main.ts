import { NestFactory } from "@nestjs/core";
import { ValidationPipe, INestApplication } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ExpressAdapter } from "@nestjs/platform-express";
import * as express from "express";
import { AppModule } from "./app.module";

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

  const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:4200")
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
    ],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Petalia AgroAssist API")
    .setVersion("2.0.0")
    .setDescription("Backend API for Petalia Farm OS - Compatible Web & Mobile")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
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
  await app.listen(port);
  console.log(`🐝 Petalia API running on port ${port}`);
}

if (require.main === module) {
  bootstrap();
}
