import { BadRequestException, NotFoundException } from "@nestjs/common";
import { sandboxOrganizationId } from "../auth/sandbox";
import { signPayload, verifySignature } from "../events/signature";
import { PublicApiContext } from "./context";
import { assertPolygon, parseBbox, polygonAreaHa } from "./geo";
import { resolveLocale } from "./i18n";
import { encodeId, tryDecodeId } from "./ids";
import { decodeCursor, encodeCursor } from "./pagination";
import { normalizePhone } from "./phone";
import { ProblemException } from "./problem";
import { toProblem } from "./problem-details.filter";
import { fromSenml } from "./vocabulary";

const UUID = "3f2b8c1e-9d4a-4e7b-8a1c-2b3c4d5e6f70";

describe("public ids", () => {
  it("round-trips a UUID through a typed, compact id", () => {
    const id = encodeId("parcel", UUID);
    expect(id).toMatch(/^prc_[0-9A-Za-z]{22}$/);
    expect(tryDecodeId("parcel", id)).toBe(UUID);
  });

  it("refuses ids of another type or malformed ids", () => {
    const id = encodeId("parcel", UUID);
    expect(tryDecodeId("farmer", id)).toBeNull();
    expect(tryDecodeId("parcel", "prc_tooShort")).toBeNull();
    expect(tryDecodeId("parcel", "prc_!!!!!!!!!!!!!!!!!!!!!!")).toBeNull();
  });

  it("keeps leading zeros", () => {
    const zero = "00000000-0000-4000-8000-000000000001";
    expect(tryDecodeId("farmer", encodeId("farmer", zero))).toBe(zero);
  });
});

describe("resolveLocale", () => {
  it.each([
    [undefined, "fr"],
    ["wo-SN,fr;q=0.8", "wo"],
    ["de-DE,en;q=0.7,fr;q=0.9", "fr"],
    ["en-GB", "en"],
    ["zh, *;q=0.1", "fr"],
  ])("%s → %s", (header, expected) => {
    expect(resolveLocale(header)).toBe(expected);
  });
});

describe("geo", () => {
  const square100m = {
    type: "Polygon",
    coordinates: [
      [
        [-16.93, 14.94],
        [-16.93 + 100 / (111_320 * Math.cos((14.94 * Math.PI) / 180)), 14.94],
        [
          -16.93 + 100 / (111_320 * Math.cos((14.94 * Math.PI) / 180)),
          14.94 + 100 / 111_320,
        ],
        [-16.93, 14.94 + 100 / 111_320],
        [-16.93, 14.94],
      ],
    ],
  };

  it("computes about one hectare for a 100 m square", () => {
    expect(polygonAreaHa(assertPolygon(square100m))).toBeCloseTo(1, 1);
  });

  it("rejects open rings and swapped coordinates", () => {
    const open = {
      type: "Polygon",
      coordinates: [square100m.coordinates[0].slice(0, 4)],
    };
    expect(() => assertPolygon(open)).toThrow(ProblemException);
    expect(() =>
      assertPolygon({
        type: "Polygon",
        coordinates: [
          [
            [200, 14],
            [1, 1],
            [2, 2],
            [200, 14],
          ],
        ],
      }),
    ).toThrow(ProblemException);
  });

  it("validates bbox order", () => {
    expect(parseBbox("-17.2,14.6,-16.8,15.1")).toEqual({
      minLng: -17.2,
      minLat: 14.6,
      maxLng: -16.8,
      maxLat: 15.1,
    });
    expect(() => parseBbox("-16.8,14.6,-17.2,15.1")).toThrow(ProblemException);
  });
});

describe("phone identity", () => {
  it("normalises Senegalese numbers to E.164", () => {
    expect(normalizePhone("77 123 45 67")).toBe("+221771234567");
    expect(normalizePhone("00221771234567")).toBe("+221771234567");
    expect(normalizePhone("+33612345678")).toBe("+33612345678");
    expect(() => normalizePhone("abc")).toThrow(ProblemException);
  });
});

describe("webhook signatures", () => {
  const secret = "whsec_test";
  const payload = JSON.stringify({ id: "evt_1", type: "observation.created" });

  it("verifies its own signature", () => {
    const header = signPayload(secret, payload, 1_800_000_000);
    expect(verifySignature(secret, payload, header, 300, 1_800_000_100)).toBe(
      true,
    );
  });

  it("rejects tampering, wrong secrets and replays", () => {
    const header = signPayload(secret, payload, 1_800_000_000);
    expect(
      verifySignature(secret, payload + " ", header, 300, 1_800_000_000),
    ).toBe(false);
    expect(
      verifySignature("whsec_other", payload, header, 300, 1_800_000_000),
    ).toBe(false);
    expect(verifySignature(secret, payload, header, 300, 1_800_000_301)).toBe(
      false,
    );
  });
});

describe("problem+json (RFC 9457)", () => {
  const ctx = (locale: PublicApiContext["locale"]): PublicApiContext => ({
    version: "2026-10-01",
    locale,
    requestId: "req_test",
  });
  const req = {
    method: "GET",
    originalUrl: "/api/v1/parcels/prc_x?limit=2",
    url: "",
  };

  it("translates catalogue errors and keeps a stable code", () => {
    const err = new ProblemException("insufficient_scope", {
      params: { scope: "parcels:read" },
    });
    const fr = toProblem(err, ctx("fr"), req);
    const wo = toProblem(err, ctx("wo"), req);
    expect(fr).toMatchObject({
      type: "https://docs.petalia.sn/errors/insufficient_scope",
      status: 403,
      code: "insufficient_scope",
      instance: "/api/v1/parcels/prc_x",
      request_id: "req_test",
    });
    expect(fr.detail).toContain("parcels:read");
    expect(wo.title).not.toBe(fr.title);
  });

  it("maps ValidationPipe errors to field errors", () => {
    const err = new BadRequestException({
      message: ["name must be a string", "property foo should not exist"],
    });
    const p = toProblem(err, ctx("en"), req);
    expect(p.code).toBe("validation_failed");
    expect(p.status).toBe(422);
    expect(p.errors).toEqual([
      { field: "name", code: "invalid", message: "name must be a string" },
      {
        field: "foo",
        code: "unknown_field",
        message: "property foo should not exist",
      },
    ]);
  });

  it("distinguishes unknown routes from missing resources", () => {
    expect(
      toProblem(
        new NotFoundException("Cannot GET /api/v1/nope"),
        ctx("fr"),
        req,
      ).code,
    ).toBe("route_missing");
    expect(
      toProblem(new NotFoundException("Parcelle introuvable"), ctx("fr"), req)
        .code,
    ).toBe("resource_missing");
  });

  it("never leaks internal errors", () => {
    const p = toProblem(new Error("password=hunter2"), ctx("fr"), req);
    expect(p.code).toBe("internal_error");
    expect(JSON.stringify(p)).not.toContain("hunter2");
  });
});

describe("SenML units", () => {
  it("converts to canonical units", () => {
    expect(fromSenml("soil_moisture", "/", 0.234)).toBeCloseTo(23.4);
    expect(fromSenml("rainfall", "m", 0.012)).toBeCloseTo(12);
    expect(fromSenml("soil_temperature", "Cel", 27.1)).toBe(27.1);
    expect(fromSenml("soil_temperature", "K", 300)).toBeNull();
  });
});

describe("cursors", () => {
  it("round-trips and rejects garbage", () => {
    const c = encodeCursor({ t: 1_792_000_000_000, id: UUID });
    expect(decodeCursor(c)).toEqual({ t: 1_792_000_000_000, id: UUID });
    expect(() => decodeCursor("not-a-cursor")).toThrow(ProblemException);
  });
});

describe("sandbox organisation", () => {
  it("is a stable UUID distinct from the real organisation", () => {
    const sandbox = sandboxOrganizationId(UUID);
    expect(sandbox).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(sandbox).toBe(sandboxOrganizationId(UUID));
    expect(sandbox).not.toBe(UUID);
  });
});
