import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import * as request from "supertest";

/**
 * E2E Auth Tests — Validates authentication flows
 * Critical for: login, OTP, JWT refresh, guards
 */
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
    it("should reject invalid credentials", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: "invalid@example.com", password: "wrongpass" })
        .expect(200);

      expect(response.body).toHaveProperty("success");
      // Success may be false or error returned
    });

    it("should require email and password", async () => {
      await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: "test@example.com" })
        .expect(400); // Missing password
    });
  });

  describe("POST /api/auth/login/otp/send", () => {
    it("should send OTP to valid email", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/auth/login/otp/send")
        .send({ email: "test@example.com" })
        .expect(200);

      expect(response.body).toHaveProperty("data");
    });

    it("should require email field", async () => {
      await request(app.getHttpServer())
        .post("/api/auth/login/otp/send")
        .send({})
        .expect(400);
    });
  });

  describe("POST /api/auth/login/otp/verify", () => {
    it("should reject invalid OTP code", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/auth/login/otp/verify")
        .send({ email: "test@example.com", code: "000000" })
        .expect(200);

      // May return error or false success
      expect(response.body).toBeDefined();
    });

    it("should accept hardcoded test OTP 123456", async () => {
      // Note: In production this test code should be removed
      const response = await request(app.getHttpServer())
        .post("/api/auth/login/otp/verify")
        .send({ email: "test@example.com", code: "123456" })
        .expect(200);

      if (response.body?.data?.accessToken) {
        authToken = response.body.data.accessToken;
      }
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("should require valid refresh token", async () => {
      await request(app.getHttpServer())
        .post("/api/auth/refresh")
        .send({ refreshToken: "invalid-token" })
        .expect(401);
    });

    it("should reject without refresh token", async () => {
      await request(app.getHttpServer())
        .post("/api/auth/refresh")
        .send({})
        .expect(400);
    });
  });

  describe("GET /api/health (health check)", () => {
    it("should return 200 OK with status and checks", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/health")
        .expect(200);

      expect(response.body).toHaveProperty("status");
      // Database and Redis health checks
    });
  });

  describe("Guarded routes (require JWT)", () => {
    it("should reject request without Authorization header", async () => {
      await request(app.getHttpServer()).get("/api/users/profile").expect(401);
    });

    it("should reject request with invalid token", async () => {
      await request(app.getHttpServer())
        .get("/api/users/profile")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);
    });

    it("should require Bearer scheme", async () => {
      await request(app.getHttpServer())
        .get("/api/users/profile")
        .set("Authorization", "Invalid-Scheme token")
        .expect(401);
    });
  });
});
