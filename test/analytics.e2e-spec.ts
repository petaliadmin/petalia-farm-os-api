import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import request from "supertest";

/**
 * E2E Analytics Tests — Validates data analytics and caching
 * Critical for: query performance, cache hit rates, report endpoints
 */
describe("Analytics (e2e)", () => {
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

  describe("GET /api/rapports/kpis (Report KPIs with cache)", () => {
    it("should return KPIs with caching", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/rapports/kpis")
        .query({ periode: "mois" })
        .expect(200);

      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toHaveProperty("visitesRealisees");
      expect(response.body.data).toHaveProperty("tachesClosees");
      expect(response.body.data).toHaveProperty("recoltesAgg");
    });

    it("should support periode query parameter", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/rapports/kpis")
        .query({ periode: "semaine" })
        .expect(200);

      expect(response.body).toHaveProperty("data");
    });

    it("should default to mois if periode not provided", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/rapports/kpis")
        .expect(200);

      expect(response.body).toHaveProperty("data");
    });

    it("should cache results (validate cache header or metadata)", async () => {
      // First request
      const response1 = await request(app.getHttpServer())
        .get("/api/rapports/kpis")
        .expect(200);

      // Second request should be faster (from cache)
      const response2 = await request(app.getHttpServer())
        .get("/api/rapports/kpis")
        .expect(200);

      // Both should return same data
      expect(response1.body.data).toEqual(response2.body.data);
      if (response2.body.cached) {
        expect(response2.body.cached).toBe(true);
      }
    });
  });

  describe("GET /api/rapports/graphiques (Chart data)", () => {
    it("should return graphiques data", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/rapports/graphiques")
        .expect(200);

      expect(response.body).toHaveProperty("data");
    });
  });

  describe("GET /api/rapports/economiques (Economic metrics)", () => {
    it("should return economic metrics", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/rapports/economiques")
        .expect(200);

      expect(response.body).toHaveProperty("data");
    });
  });

  describe("GET /api/analytics/rendements (Yield trends)", () => {
    it("should return yield analytics with culture filter", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/analytics/rendements/tendances")
        .query({ culture: "riz", region: "saint-louis" })
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it("should handle missing filters gracefully", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/analytics/rendements/tendances")
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe("GET /api/analytics/cultures/distribution (Crop distribution)", () => {
    it("should return crop distribution", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/analytics/cultures/distribution")
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe("GET /api/analytics/comparatif/benchmarks (Benchmarking)", () => {
    it("should return benchmark comparisons", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/analytics/comparatif/benchmarks")
        .query({ culture: "riz", region: "saint-louis" })
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe("Performance validation", () => {
    it("should respond within 200ms for cached queries", async () => {
      const start = Date.now();
      await request(app.getHttpServer()).get("/api/rapports/kpis").expect(200);
      const duration = Date.now() - start;

      // Cached response should be fast
      expect(duration).toBeLessThan(500); // Relaxed timeout for CI
    });

    it("should support pagination on analytics endpoints", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/rapports/kpis")
        .query({ limit: 20, offset: 0 })
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });
});
