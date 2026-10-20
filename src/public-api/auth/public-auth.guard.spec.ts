import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ApiKeyService } from "../../partner/api-key.service";
import { ApiKey } from "../../partner/entities/api-key.entity";
import { ProblemException } from "../common/problem";
import {
  ALLOW_PUBLISHABLE_KEY,
  PUBLIC_SCOPES_KEY,
  TEST_MODE_ONLY_KEY,
} from "./decorators";
import { PublicAuthGuard } from "./public-auth.guard";
import { sandboxOrganizationId } from "./sandbox";

const ORG = "3f2b8c1e-9d4a-4e7b-8a1c-2b3c4d5e6f70";

function key(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    organisationId: ORG,
    scopes: ["parcels:read"],
    mode: "live",
    kind: "secret",
    ...overrides,
  } as ApiKey;
}

function setup(apiKey: ApiKey, metadata: Record<string, unknown> = {}) {
  const apiKeys = {
    verify: jest.fn().mockResolvedValue({ apiKey, scopes: apiKey.scopes }),
    findActive: jest.fn(),
  } as unknown as ApiKeyService;
  const reflector = {
    getAllAndOverride: (k: string) => metadata[k],
  } as unknown as Reflector;
  const guard = new PublicAuthGuard(apiKeys, {} as JwtService, reflector);
  const req: Record<string, unknown> = {
    headers: { authorization: "Bearer sk_live_abcdefgh12345678" },
  };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
  return { guard, req, ctx, apiKeys };
}

async function problemCode(p: Promise<unknown>) {
  try {
    await p;
  } catch (err) {
    return (err as ProblemException).code;
  }
  return null;
}

describe("PublicAuthGuard", () => {
  it("authenticates a secret key and exposes the client", async () => {
    const { guard, req, ctx } = setup(key(), {
      [PUBLIC_SCOPES_KEY]: ["parcels:read"],
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect((req.publicApi as { client: unknown }).client).toMatchObject({
      organizationId: ORG,
      livemode: true,
      kind: "secret",
    });
  });

  it("requires a credential", async () => {
    const { guard, req, ctx } = setup(key());
    req.headers = {};
    expect(await problemCode(guard.canActivate(ctx))).toBe(
      "authentication_required",
    );
  });

  it("maps an invalid key to invalid_api_key", async () => {
    const { guard, ctx, apiKeys } = setup(key());
    (apiKeys.verify as jest.Mock).mockRejectedValue(
      new UnauthorizedException(),
    );
    expect(await problemCode(guard.canActivate(ctx))).toBe("invalid_api_key");
  });

  it("enforces scopes", async () => {
    const { guard, ctx } = setup(key(), {
      [PUBLIC_SCOPES_KEY]: ["parcels:write"],
    });
    expect(await problemCode(guard.canActivate(ctx))).toBe(
      "insufficient_scope",
    );
  });

  it("keeps publishable keys on open endpoints", async () => {
    const pk = key({ kind: "publishable" });
    expect(await problemCode(setup(pk).guard.canActivate(setup(pk).ctx))).toBe(
      "publishable_key_not_allowed",
    );
    const open = setup(pk, { [ALLOW_PUBLISHABLE_KEY]: true });
    await expect(open.guard.canActivate(open.ctx)).resolves.toBe(true);
  });

  it("routes test keys to the sandbox organisation", async () => {
    const { guard, req, ctx } = setup(key({ mode: "test" }), {
      [TEST_MODE_ONLY_KEY]: true,
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(
      (req.publicApi as { client: Record<string, unknown> }).client,
    ).toMatchObject({
      organizationId: sandboxOrganizationId(ORG),
      accountOrganizationId: ORG,
      livemode: false,
    });
  });

  it("refuses live keys on test-only endpoints", async () => {
    const { guard, ctx } = setup(key(), { [TEST_MODE_ONLY_KEY]: true });
    expect(await problemCode(guard.canActivate(ctx))).toBe("test_mode_only");
  });
});
