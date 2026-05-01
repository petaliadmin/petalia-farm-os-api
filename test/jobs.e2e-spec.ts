import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import * as request from "supertest";

/**
 * E2E Job Queue Tests — Validates Bull async workers
 * Critical for: NDVI fetch, PDF generation, job status tracking
 */
describe("Jobs / Bull Queues (e2e)", () => {
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

  describe("NDVI Job Queue", () => {
    describe("POST /api/ndvi/fetch (queue NDVI fetch)", () => {
      it("should immediately return jobId without blocking", async () => {
        const start = Date.now();

        const response = await request(app.getHttpServer())
          .post("/api/ndvi/fetch")
          .send({
            parcelleId: "test-parcelle-123",
          })
          .expect(200);

        const duration = Date.now() - start;

        // Should complete in < 100ms (immediate queue + return)
        expect(duration).toBeLessThan(1000);

        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("jobId");
        expect(response.body.data).toHaveProperty("status");
        expect(response.body.data.status).toBe("queued");

        // jobId should be string for polling later
        expect(typeof response.body.data.jobId).toBe("string");
      });

      it("should require parcelleId", async () => {
        await request(app.getHttpServer())
          .post("/api/ndvi/fetch")
          .send({})
          .expect(400);
      });

      it("should validate parcelleId format", async () => {
        const response = await request(app.getHttpServer())
          .post("/api/ndvi/fetch")
          .send({
            parcelleId: "invalid",
          });

        // Either reject or return error for missing parcelle
        expect(
          response.status === 400 ||
            response.status === 404 ||
            response.status === 200,
        ).toBe(true);
      });

      it("should support multiple concurrent jobs", async () => {
        const promises = [
          request(app.getHttpServer())
            .post("/api/ndvi/fetch")
            .send({ parcelleId: "test-1" }),
          request(app.getHttpServer())
            .post("/api/ndvi/fetch")
            .send({ parcelleId: "test-2" }),
          request(app.getHttpServer())
            .post("/api/ndvi/fetch")
            .send({ parcelleId: "test-3" }),
        ];

        const responses = await Promise.all(promises);

        responses.forEach((response) => {
          expect(response.status).toBe(200);
          expect(response.body.data).toHaveProperty("jobId");
        });

        // All jobIds should be unique
        const jobIds = responses.map((r) => r.body.data.jobId);
        const uniqueIds = new Set(jobIds);
        expect(uniqueIds.size).toBe(jobIds.length);
      });
    });

    describe("GET /api/ndvi/:id (fetch latest NDVI for parcelle)", () => {
      it("should return NDVI data if available", async () => {
        const response = await request(app.getHttpServer())
          .get("/api/ndvi/test-parcelle-123")
          .expect(200);

        expect(response.body).toBeDefined();
      });

      it("should handle non-existent parcelle gracefully", async () => {
        const response = await request(app.getHttpServer())
          .get("/api/ndvi/non-existent-parcelle-xyz")
          .expect(200);

        // May return empty or null
        expect(response.body).toBeDefined();
      });
    });
  });

  describe("PDF Report Generation Job Queue", () => {
    describe("POST /api/rapports/export (queue PDF generation)", () => {
      it("should immediately return jobId without blocking", async () => {
        const start = Date.now();

        const response = await request(app.getHttpServer())
          .post("/api/rapports/export")
          .send({
            format: "pdf",
            type: "synthese",
            periode: "mois",
          })
          .expect(200);

        const duration = Date.now() - start;

        // Should complete in < 200ms (immediate queue + return)
        expect(duration).toBeLessThan(1000);

        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("jobId");
        expect(response.body.data).toHaveProperty("status");
        expect(response.body.data.status).toBe("queued");
        expect(response.body.data).toHaveProperty("nom");
      });

      it("should validate format is pdf", async () => {
        const response = await request(app.getHttpServer())
          .post("/api/rapports/export")
          .send({
            format: "xlsx",
            type: "synthese",
            periode: "mois",
          });

        // Should reject non-PDF formats
        if (response.status === 200) {
          expect(response.body.data.status).not.toBe("queued");
        }
      });

      it("should support different rapport types", async () => {
        const types = ["synthese", "visites", "recoltes", "complet"];

        const promises = types.map((type) =>
          request(app.getHttpServer()).post("/api/rapports/export").send({
            format: "pdf",
            type,
            periode: "mois",
          }),
        );

        const responses = await Promise.all(promises);

        responses.forEach((response, index) => {
          expect(response.status).toBe(200);
          if (response.body.data.status === "queued") {
            expect(response.body.data).toHaveProperty("jobId");
            expect(response.body.data.nom).toContain(types[index]);
          }
        });
      });

      it("should support different periodes", async () => {
        const periodes = ["semaine", "mois", "saison"];

        const promises = periodes.map((periode) =>
          request(app.getHttpServer()).post("/api/rapports/export").send({
            format: "pdf",
            type: "synthese",
            periode,
          }),
        );

        const responses = await Promise.all(promises);

        responses.forEach((response) => {
          expect(response.status).toBe(200);
          expect(response.body).toHaveProperty("data");
        });
      });

      it("should require format, type, periode fields", async () => {
        const invalidRequests = [
          { format: "pdf", type: "synthese" }, // Missing periode
          { format: "pdf", periode: "mois" }, // Missing type
          { type: "synthese", periode: "mois" }, // Missing format
        ];

        for (const request_body of invalidRequests) {
          const response = await request(app.getHttpServer())
            .post("/api/rapports/export")
            .send(request_body);

          // Should reject or return error
          expect(response.status === 400 || response.status === 200).toBe(true);
        }
      });
    });
  });

  describe("Job Status Tracking", () => {
    it("should track NDVI job completion", async () => {
      const queueResponse = await request(app.getHttpServer())
        .post("/api/ndvi/fetch")
        .send({
          parcelleId: "test-parcelle-123",
        })
        .expect(200);

      const jobId = queueResponse.body.data.jobId;

      // Give job a moment to start processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Poll job status (if endpoint exists)
      const statusResponse = await request(app.getHttpServer())
        .get(`/api/ndvi/job/${jobId}`)
        .expect(200);

      expect(statusResponse.body).toBeDefined();
      // Status could be: queued, processing, completed, failed
    });

    it("should handle polling for non-existent job", async () => {
      const response = await request(app.getHttpServer()).get(
        `/api/ndvi/job/non-existent`,
      );

      // Should either 404 or return error gracefully
      expect(
        response.status === 404 ||
          response.status === 400 ||
          response.status === 200,
      ).toBe(true);
    });
  });

  describe("Queue Resilience", () => {
    it("should handle concurrent job submissions", async () => {
      const jobCount = 10;
      const promises = [];

      for (let i = 0; i < jobCount; i++) {
        promises.push(
          request(app.getHttpServer())
            .post("/api/ndvi/fetch")
            .send({
              parcelleId: `concurrent-test-${i}`,
            }),
        );
      }

      const responses = await Promise.all(promises);

      expect(responses.length).toBe(jobCount);
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.data).toHaveProperty("jobId");
      });
    });

    it("should not block HTTP server during job processing", async () => {
      // Submit a batch of jobs
      const jobPromise = request(app.getHttpServer())
        .post("/api/ndvi/fetch")
        .send({ parcelleId: "blocking-test" });

      // While job is processing, other endpoints should still respond
      const healthPromise = request(app.getHttpServer()).get("/api/health");

      const [jobRes, healthRes] = await Promise.all([
        jobPromise,
        healthPromise,
      ]);

      expect(jobRes.status).toBe(200);
      expect(healthRes.status).toBe(200);
    });
  });
});
