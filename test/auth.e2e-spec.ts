import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import * as request from "supertest";

describe("Auth (e2e)", () => {
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

  describe("POST /api/auth/login", () => {
    it("should return 200 with invalid credentials (success: false)", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: "invalid@example.com", password: "wrongpass" })
        .expect(200);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error");
    });

    // Note: actual login test would require seeded test database
    // This is a placeholder to validate route structure
  });

  describe("GET /api/parcelles/stats (public endpoint)", () => {
    it("should return statistics", async () => {
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
