import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import request from "supertest";
import { Repository } from "typeorm";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/main";
import { Organisation } from "../src/organisations/entities/organisation.entity";
import { Parcelle } from "../src/parcelles/entities/parcelle.entity";
import { ApiKeyService } from "../src/partner/api-key.service";

/**
 * End-to-end contract of the public API. Needs Postgres (PostGIS) and Redis,
 * e.g. DB_PORT / REDIS_PORT pointing at throwaway containers.
 */
describe("Public API /api/v1 (e2e)", () => {
  let app: INestApplication;
  let coopId: string;
  let coopTest: string;
  let coopLive: string;
  let coopKeyId: string;
  let fintechTest: string;
  let parcels: Repository<Parcelle>;

  const api = () => request(app.getHttpServer());
  const as = (key: string) => ({ Authorization: `Bearer ${key}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app);
    await app.init();

    const orgs = app.get<Repository<Organisation>>(
      getRepositoryToken(Organisation),
    );
    parcels = app.get(getRepositoryToken(Parcelle));
    const stamp = Date.now();
    const coop = await orgs.save(
      orgs.create({ nom: `Coop Niayes ${stamp}`, type: "cooperative" }),
    );
    const fintech = await orgs.save(
      orgs.create({ nom: `AgriCredit ${stamp}`, sigle: "AGC", type: "autre" }),
    );
    coopId = coop.id;

    const keys = app.get(ApiKeyService);
    const t = await keys.create({
      organisationId: coop.id,
      partenaireNom: "coop-test",
      mode: "test",
    });
    coopTest = t.rawKey;
    coopKeyId = t.apiKey.id;
    coopLive = (
      await keys.create({ organisationId: coop.id, partenaireNom: "coop-live" })
    ).rawKey;
    fintechTest = (
      await keys.create({
        organisationId: fintech.id,
        partenaireNom: "fintech-test",
        mode: "test",
      })
    ).rawKey;
  });

  afterAll(async () => {
    await app?.close();
  });

  describe("contract", () => {
    it("issues typed keys and echoes version and request id", async () => {
      expect(coopTest).toMatch(/^sk_test_/);
      expect(coopLive).toMatch(/^sk_live_/);
      const res = await api()
        .get("/api/v1/organization")
        .set(as(coopTest))
        .expect(200);
      expect(res.headers["petalia-version"]).toBe("2026-10-01");
      expect(res.headers["request-id"]).toMatch(/^req_/);
      expect(res.body).toMatchObject({
        object: "organization",
        livemode: false,
      });
      expect(res.body.id).toMatch(/^org_/);
    });

    it("rejects unknown versions with problem+json", async () => {
      const res = await api()
        .get("/api/v1/organization")
        .set(as(coopTest))
        .set("Petalia-Version", "2020-01-01")
        .expect(400);
      expect(res.headers["content-type"]).toContain("application/problem+json");
      expect(res.body.code).toBe("unsupported_api_version");
    });

    it("translates errors from Accept-Language", async () => {
      const fr = await api().get("/api/v1/parcels").expect(401);
      const wo = await api()
        .get("/api/v1/parcels")
        .set("Accept-Language", "wo-SN")
        .expect(401);
      expect(fr.body.code).toBe("authentication_required");
      expect(wo.body.title).not.toBe(fr.body.title);
      expect(wo.headers["content-language"]).toBe("wo");
    });

    it("keeps legacy routes on their own error format", async () => {
      const res = await api().get("/api/v1/sync/pull").expect(401);
      expect(res.headers["content-type"]).not.toContain("problem+json");
    });

    it("answers unknown public routes with route_missing", async () => {
      const res = await api()
        .get("/api/v1/nothing-here")
        .set(as(coopTest))
        .expect(404);
      expect(res.body.code).toBe("route_missing");
    });
  });

  describe("sandbox and parcels", () => {
    it("seeds only in test mode", async () => {
      const live = await api()
        .post("/api/v1/test_helpers/sandbox")
        .set(as(coopLive))
        .expect(403);
      expect(live.body.code).toBe("test_mode_only");

      const res = await api()
        .post("/api/v1/test_helpers/sandbox")
        .set(as(coopTest))
        .expect(201);
      expect(res.body.parcels).toHaveLength(3);
      expect(res.body.observations_created).toBeGreaterThan(100);
    });

    it("never leaks sandbox data into the real organisation", async () => {
      expect(await parcels.count({ where: { organisationId: coopId } })).toBe(
        0,
      );
      const live = await api()
        .get("/api/v1/parcels")
        .set(as(coopLive))
        .expect(200);
      expect(live.body.data).toHaveLength(0);
    });

    it("paginates with cursors", async () => {
      const first = await api()
        .get("/api/v1/parcels?limit=2")
        .set(as(coopTest))
        .expect(200);
      expect(first.body).toMatchObject({ object: "list", has_more: true });
      expect(first.body.data).toHaveLength(2);
      const next = await api()
        .get(`/api/v1/parcels?limit=2&cursor=${first.body.next_cursor}`)
        .set(as(coopTest))
        .expect(200);
      expect(next.body.has_more).toBe(false);
      expect(next.body.data).toHaveLength(1);
      const ids = [...first.body.data, ...next.body.data].map((p) => p.id);
      expect(new Set(ids).size).toBe(3);
      expect(first.body.data[0].area.unit).toBe("ha");
    });

    it("filters by location and serves GeoJSON", async () => {
      const near = await api()
        .get("/api/v1/parcels?near=15.137,-16.965&radius=2000")
        .set(as(coopTest))
        .expect(200);
      expect(near.body.data).toHaveLength(1);
      expect(near.body.data[0].agroecological_zone).toBe("Niayes");

      const bbox = await api()
        .get("/api/v1/parcels?bbox=-16.5,13.5,-15.5,14&format=geojson")
        .set(as(coopTest))
        .expect(200);
      expect(bbox.body.type).toBe("FeatureCollection");
      expect(bbox.body.features).toHaveLength(1);
      expect(bbox.body.features[0].properties.current_crop.crop).toBe(
        "groundnut",
      );
    });

    it("rejects invalid geometries", async () => {
      const res = await api()
        .post("/api/v1/parcels")
        .set(as(coopTest))
        .send({
          name: "Bad",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [0, 0],
                [1, 1],
                [0, 1],
              ],
            ],
          },
        })
        .expect(422);
      expect(res.body.code).toBe("invalid_geometry");
    });
  });

  describe("farmers, idempotency and identity", () => {
    let farmerId: string;
    const phone = `+22176${String(Date.now()).slice(-7)}`;

    it("replays a POST sent twice with the same Idempotency-Key", async () => {
      const body = {
        phone,
        first_name: "Fatou",
        last_name: "Diop",
        preferred_language: "wo",
      };
      const first = await api()
        .post("/api/v1/farmers")
        .set(as(coopTest))
        .set("Idempotency-Key", `farmer-${phone}`)
        .send(body)
        .expect(201);
      const again = await api()
        .post("/api/v1/farmers")
        .set(as(coopTest))
        .set("Idempotency-Key", `farmer-${phone}`)
        .send(body)
        .expect(201);
      expect(again.headers["idempotent-replayed"]).toBe("true");
      expect(again.body.id).toBe(first.body.id);
      farmerId = first.body.id;
      expect(farmerId).toMatch(/^fmr_/);

      const reused = await api()
        .post("/api/v1/farmers")
        .set(as(coopTest))
        .set("Idempotency-Key", `farmer-${phone}`)
        .send({ ...body, first_name: "Other" })
        .expect(422);
      expect(reused.body.code).toBe("idempotency_key_reused");
    });

    it("treats the phone number as identity", async () => {
      const res = await api()
        .post("/api/v1/farmers")
        .set(as(fintechTest))
        .send({
          phone: phone.replace("+221", "0"),
          first_name: "X",
          last_name: "Y",
        })
        .expect(409);
      expect(res.body.code).toBe("farmer_already_registered");
      expect(res.body.farmer).toBeUndefined();
    });

    it("validates bodies field by field", async () => {
      const res = await api()
        .post("/api/v1/farmers")
        .set(as(coopTest))
        .send({ phone: "77", first_name: "", last_name: "Y", unknown: 1 })
        .expect(422);
      expect(res.body.code).toBe("validation_failed");
      const fields = res.body.errors.map((e: { field: string }) => e.field);
      expect(fields).toEqual(expect.arrayContaining(["first_name", "unknown"]));
    });
  });

  describe("observations", () => {
    let parcel: string;
    let device: string;

    beforeAll(async () => {
      const res = await api().get("/api/v1/devices").set(as(coopTest));
      device = res.body.data[0].id;
      parcel = res.body.data[0].parcel;
    });

    it("ingests batches and ignores resent readings", async () => {
      const at = new Date(Date.now() - 60_000).toISOString();
      const reading = {
        device,
        property: "soil_moisture",
        value: 22.5,
        unit: "%",
        observed_at: at,
      };
      const res = await api()
        .post("/api/v1/observations:batch")
        .set(as(coopTest))
        .send({
          observations: [
            reading,
            reading,
            {
              parcel,
              property: "rainfall",
              value: 12,
              unit: "mm",
              observed_at: at,
              source_type: "manual",
            },
          ],
        })
        .expect(201);
      expect(res.body).toMatchObject({
        received: 3,
        created: 2,
        duplicates: 1,
      });
      expect(res.body.data[0].source).toMatchObject({ type: "sensor", device });
    });

    it("refuses implicit or wrong units", async () => {
      const res = await api()
        .post("/api/v1/observations:batch")
        .set(as(coopTest))
        .send({
          observations: [
            {
              parcel,
              property: "air_temperature",
              value: 80,
              unit: "°F",
              observed_at: new Date().toISOString(),
            },
          ],
        })
        .expect(422);
      expect(res.body.errors[0]).toMatchObject({
        field: "observations[0].unit",
        code: "invalid_unit",
      });
    });

    it("accepts SenML packs with unit conversion", async () => {
      const bt = Math.floor(Date.now() / 1000) - 120;
      const res = await api()
        .post(`/api/v1/devices/${device}/senml`)
        .set(as(coopTest))
        .send([
          { bn: "urn:dev:deveui:A84041000181C2E1:", bt },
          { n: "soil_moisture", u: "/", v: 0.31 },
          { n: "soil_temperature", u: "Cel", v: 26.4 },
        ])
        .expect(201);
      expect(res.body.created).toBe(2);
      const moisture = res.body.data.find(
        (o: { property: string }) => o.property === "soil_moisture",
      );
      expect(moisture).toMatchObject({ value: 31, unit: "%" });
    });

    it("lists a time series for a parcel", async () => {
      const res = await api()
        .get(
          `/api/v1/observations?parcel=${parcel}&property=soil_temperature&limit=5`,
        )
        .set(as(coopTest))
        .expect(200);
      expect(res.body.data).toHaveLength(5);
      const times = res.body.data.map(
        (o: { observed_at: string }) => o.observed_at,
      );
      expect([...times].sort().reverse()).toEqual(times);
    });
  });

  describe("consent and data sovereignty", () => {
    let farmer: string;
    let consent: string;
    let code: string;

    beforeAll(async () => {
      const res = await api()
        .get("/api/v1/farmers?limit=100")
        .set(as(coopTest));
      farmer = res.body.data.find(
        (f: { metadata: Record<string, string> }) =>
          f.metadata.zone === "Niayes",
      ).id;
    });

    it("hides other organisations' farmers", async () => {
      const res = await api()
        .get(`/api/v1/farmers/${farmer}`)
        .set(as(fintechTest))
        .expect(404);
      expect(res.body.code).toBe("resource_missing");
      const list = await api()
        .get(`/api/v1/parcels?farmer=${farmer}`)
        .set(as(fintechTest))
        .expect(200);
      expect(list.body.data).toHaveLength(0);
    });

    it("refuses scopes a farmer cannot delegate", async () => {
      const res = await api()
        .post("/api/v1/consents")
        .set(as(fintechTest))
        .send({
          farmer,
          scopes: ["parcels:write"],
          purpose: "Gérer vos parcelles",
        })
        .expect(422);
      expect(res.body.code).toBe("scope_not_consentable");
    });

    it("grants access after the farmer's code", async () => {
      const created = await api()
        .post("/api/v1/consents")
        .set(as(fintechTest))
        .send({
          farmer,
          scopes: ["parcels:read", "observations:read"],
          purpose: "Évaluer un crédit intrants campagne 2026",
        })
        .expect(201);
      expect(created.body.status).toBe("pending");
      consent = created.body.id;
      code = created.body.test_confirmation_code;
      expect(code).toMatch(/^\d{6}$/);

      const wrong = await api()
        .post(`/api/v1/consents/${consent}/confirm`)
        .set(as(fintechTest))
        .send({ code: code === "000000" ? "111111" : "000000" })
        .expect(422);
      expect(wrong.body.code).toBe("consent_invalid_code");

      const ok = await api()
        .post(`/api/v1/consents/${consent}/confirm`)
        .set(as(fintechTest))
        .send({ code })
        .expect(200);
      expect(ok.body.status).toBe("active");
    });

    it("exposes only the consented scopes", async () => {
      const list = await api()
        .get(`/api/v1/parcels?farmer=${farmer}`)
        .set(as(fintechTest))
        .expect(200);
      expect(list.body.data).toHaveLength(1);
      const obs = await api()
        .get(`/api/v1/observations?parcel=${list.body.data[0].id}&limit=3`)
        .set(as(fintechTest))
        .expect(200);
      expect(obs.body.data).toHaveLength(3);
      // farmers:read was not granted
      await api()
        .get(`/api/v1/farmers/${farmer}`)
        .set(as(fintechTest))
        .expect(404);
    });

    it("journals who read the farmer's data", async () => {
      // access logs are written asynchronously
      await new Promise((r) => setTimeout(r, 300));
      const res = await api()
        .get(`/api/v1/farmers/${farmer}/access_logs?limit=100`)
        .set(as(coopTest))
        .expect(200);
      const viaConsent = res.body.data.filter(
        (l: { basis: string }) => l.basis === "consent",
      );
      expect(viaConsent.length).toBeGreaterThan(0);
      expect(viaConsent[0].organization).toMatch(/^org_/);
      // third parties never see the journal
      await api()
        .get(`/api/v1/farmers/${farmer}/access_logs`)
        .set(as(fintechTest))
        .expect(404);
    });

    it("lets the cooperative revoke on the farmer's behalf", async () => {
      const res = await api()
        .post(`/api/v1/consents/${consent}/revoke`)
        .set(as(coopTest))
        .expect(200);
      expect(res.body.status).toBe("revoked");
      const list = await api()
        .get(`/api/v1/parcels?farmer=${farmer}`)
        .set(as(fintechTest))
        .expect(200);
      expect(list.body.data).toHaveLength(0);
    });
  });

  describe("offline sync", () => {
    it("pages through changes then returns only new ones", async () => {
      let cursor: string | undefined;
      let total = 0;
      for (let i = 0; i < 20; i++) {
        const res = await api()
          .get(`/api/v1/sync?limit=4${cursor ? `&cursor=${cursor}` : ""}`)
          .set(as(coopTest))
          .expect(200);
        total += res.body.data.length;
        cursor = res.body.next_cursor;
        if (!res.body.has_more) break;
      }
      expect(total).toBeGreaterThanOrEqual(3 + 3 + 3 + 3 + 3);

      const idle = await api()
        .get(`/api/v1/sync?cursor=${cursor}`)
        .set(as(coopTest))
        .expect(200);
      expect(idle.body.data).toHaveLength(0);

      const farmers = await api()
        .get("/api/v1/farmers?limit=1")
        .set(as(coopTest));
      await api()
        .patch(`/api/v1/farmers/${farmers.body.data[0].id}`)
        .set(as(coopTest))
        .send({ locality: "Touba" })
        .expect(200);
      const delta = await api()
        .get(`/api/v1/sync?cursor=${cursor}`)
        .set(as(coopTest))
        .expect(200);
      expect(delta.body.data).toHaveLength(1);
      expect(delta.body.data[0]).toMatchObject({
        object: "farmer",
        locality: "Touba",
        deleted: false,
      });
    });
  });

  describe("jobs, channels, webhooks, events", () => {
    it("runs NDVI as an async job", async () => {
      const list = await api().get("/api/v1/parcels?limit=1").set(as(coopTest));
      const job = await api()
        .post(`/api/v1/parcels/${list.body.data[0].id}/ndvi_analyses`)
        .set(as(coopTest))
        .expect(202);
      expect(job.body.id).toMatch(/^job_/);
      const polled = await api()
        .get(`/api/v1/jobs/${job.body.id}`)
        .set(as(coopTest))
        .expect(200);
      expect(polled.body.status).toBe("succeeded");
      expect(polled.body.result.ndvi.unit).toBe("1");
    });

    it("sends over SMS and reports unavailable channels", async () => {
      const farmers = await api()
        .get("/api/v1/farmers?limit=1")
        .set(as(coopTest));
      const sms = await api()
        .post("/api/v1/notifications")
        .set(as(coopTest))
        .send({
          farmer: farmers.body.data[0].id,
          channel: "sms",
          body: "Pluie prévue demain.",
        })
        .expect(201);
      expect(sms.body).toMatchObject({
        object: "notification",
        status: "sent",
        channel: "sms",
      });
      const ussd = await api()
        .post("/api/v1/notifications")
        .set(as(coopTest))
        .send({
          farmer: farmers.body.data[0].id,
          channel: "ussd",
          body: "Test",
        })
        .expect(422);
      expect(ussd.body.code).toBe("channel_unavailable");
    });

    it("guards webhook targets and returns the secret once", async () => {
      const internal = await api()
        .post("/api/v1/webhook_endpoints")
        .set(as(coopTest))
        .send({ url: "http://169.254.169.254/latest", enabled_events: ["*"] })
        .expect(422);
      expect(internal.body.errors[0].code).toBe("invalid_url");

      const created = await api()
        .post("/api/v1/webhook_endpoints")
        .set(as(coopTest))
        .send({
          url: "https://hooks.example.com/petalia",
          enabled_events: ["observation.created"],
        })
        .expect(201);
      expect(created.body.secret).toMatch(/^whsec_/);
      const read = await api()
        .get(`/api/v1/webhook_endpoints/${created.body.id}`)
        .set(as(coopTest))
        .expect(200);
      expect(read.body.secret).toBeUndefined();
      await api()
        .delete(`/api/v1/webhook_endpoints/${created.body.id}`)
        .set(as(coopTest))
        .expect(200);
    });

    it("records events", async () => {
      const res = await api()
        .get("/api/v1/events?type=farmer.created")
        .set(as(coopTest))
        .expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toMatchObject({
        object: "event",
        type: "farmer.created",
      });
      expect(res.body.data[0].data.object.object).toBe("farmer");
    });
  });

  describe("OAuth2 client_credentials", () => {
    it("exchanges a key for a narrowed token", async () => {
      const keyRes = await api().get("/api/v1/organization").set(as(coopTest));
      const clientId = keyRes.body.api_key.id;
      const token = await api()
        .post("/api/v1/oauth/token")
        .type("form")
        .send({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: coopTest,
          scope: "parcels:read",
        })
        .expect(200);
      expect(token.body).toMatchObject({
        token_type: "Bearer",
        scope: "parcels:read",
      });

      const bearer = { Authorization: `Bearer ${token.body.access_token}` };
      await api().get("/api/v1/parcels").set(bearer).expect(200);
      const denied = await api().get("/api/v1/farmers").set(bearer).expect(403);
      expect(denied.body.code).toBe("insufficient_scope");
      // the token is not a user session on the internal API
      await api().get("/api/parcelles").set(bearer).expect(401);
      expect(coopKeyId).toBeDefined();
    });

    it("rejects bad credentials", async () => {
      const res = await api()
        .post("/api/v1/oauth/token")
        .send({
          grant_type: "client_credentials",
          client_id: "key_x",
          client_secret: "sk_test_nope",
        })
        .expect(401);
      expect(res.body.code).toBe("invalid_client");
    });
  });

  describe("developer experience", () => {
    it("publishes OpenAPI and llms.txt", async () => {
      const doc = await api().get("/api/v1/openapi.json").expect(200);
      expect(doc.body.paths["/api/v1/observations:batch"]).toBeDefined();
      expect(doc.body.paths["/api/v1/parcelles"]).toBeUndefined();
      const llms = await api().get("/api/v1/llms.txt").expect(200);
      expect(llms.text).toContain("# Petalia API");
      expect(llms.text).toContain("POST /api/v1/consents");
    });
  });
});
