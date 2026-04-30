import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import * as request from "supertest";

describe("Parcelles (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/parcelles/stats (public)", () => {
    it("should return parcelle statistics", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/parcelles/stats")
        .expect(200);

      expect(response.body).toHaveProperty("total");
      expect(response.body).toHaveProperty("urgentes");
      expect(response.body).toHaveProperty("enAttention");
      expect(response.body).toHaveProperty("totalHa");
    });
  });
});
