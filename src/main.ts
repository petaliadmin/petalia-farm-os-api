import { NestFactory } from "@nestjs/core";
import {
  ValidationPipe,
  INestApplication,
  NestApplicationOptions,
} from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ExpressAdapter } from "@nestjs/platform-express";
import { Logger as PinoLogger } from "nestjs-pino";
import * as express from "express";
import { AppModule } from "./app.module";
import { setupPublicApiDocs } from "./public-api/openapi";
import { isServerless } from "./common/runtime";
import { installServerlessBullPatch } from "./serverless/bull-serverless";

/** Fronts publics de Petalia, autorisés quel que soit CORS_ORIGIN. */
export const FIRST_PARTY_ORIGINS = [
  "https://www.petalia.sn",
  "https://petalia.sn",
  "https://developers.petalia.sn",
];

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

  // CORS_ORIGIN liste les fronts de la plateforme ; le site vitrine et
  // l'espace développeur sont toujours autorisés (formulaires, console)
  const allowedOrigins = [
    ...(process.env.CORS_ORIGIN || "http://localhost:4200").split(","),
    ...FIRST_PARTY_ORIGINS,
  ]
    .map((o) => o.trim())
    .filter(Boolean);

  // Derrière le proxy Vercel / nginx / ELB : l'IP du client (limites par IP)
  // vient de X-Forwarded-For. TRUST_PROXY=0 pour un accès direct sans proxy.
  const trustProxy = Number(process.env.TRUST_PROXY ?? 1);
  (app.getHttpAdapter().getInstance() as express.Express).set(
    "trust proxy",
    Number.isFinite(trustProxy) ? trustProxy : 1,
  );

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
  if (isServerless()) installServerlessBullPatch();
  // Vercel keeps a limited number of log lines per invocation: the ~250
  // "Mapped route" lines of a cold start would push any boot error out.
  const options: NestApplicationOptions = isServerless()
    ? { logger: ["error", "warn"] }
    : {};
  const app = expressInstance
    ? await NestFactory.create(
        AppModule,
        new ExpressAdapter(expressInstance),
        options,
      )
    : await NestFactory.create(AppModule, options);
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
