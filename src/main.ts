import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

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

  app.enableCors({
    origin: configService.get("CORS_ORIGIN") || "http://localhost:4200",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: [
      "Authorization",
      "X-App-Version",
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
  SwaggerModule.setup("api/docs", app, document);

  const port = configService.get("PORT") || 3000;
  await app.listen(port);
  console.log(`🐝 Petalia API running on port ${port}`);
}
bootstrap();
