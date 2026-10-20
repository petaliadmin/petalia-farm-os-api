import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { Repository } from "typeorm";
import { BillingService } from "../billing/billing.service";
import { PlanCode } from "../billing/entities/plan.entity";
import { Organisation } from "../organisations/entities/organisation.entity";
import { ApiKeyService } from "../partner/api-key.service";
import { ApiKey } from "../partner/entities/api-key.entity";
import { SmsService } from "../sms/sms.service";
import {
  DEFAULT_KEY_POLICY,
  limitsFor,
  loadKeyPolicy,
} from "./developer-key-policy";
import {
  DeveloperService,
  maskPhone,
  normalizePhone,
} from "./developer.service";
import { DeveloperAccount } from "./entities/developer-account.entity";

const ORG = "3f2b8c1e-9d4a-4e7b-8a1c-2b3c4d5e6f70";
const SESSION = { accountId: "acc-1", organisationId: ORG };
const DAY = 24 * 60 * 60 * 1000;

function setup(opts: { plan?: PlanCode; activeKeys?: number } = {}) {
  const qb = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getCount: jest.fn().mockResolvedValue(opts.activeKeys ?? 0),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 0 }),
  };
  const accounts = {
    findOne: jest.fn(),
    create: jest.fn((d: Partial<DeveloperAccount>) => d),
    save: jest.fn((d: Partial<DeveloperAccount>) =>
      Promise.resolve({ id: "acc-1", ...d }),
    ),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    increment: jest.fn(),
    createQueryBuilder: jest.fn(() => qb),
  } as unknown as jest.Mocked<Repository<DeveloperAccount>>;
  const organisations = {
    create: jest.fn((d: Partial<Organisation>) => d),
    save: jest.fn((d: Partial<Organisation>) =>
      Promise.resolve({ id: ORG, ...d }),
    ),
  } as unknown as jest.Mocked<Repository<Organisation>>;
  const keysRepo = {
    createQueryBuilder: jest.fn(() => qb),
  } as unknown as Repository<ApiKey>;
  const apiKeys = {
    create: jest.fn((input) =>
      Promise.resolve({
        apiKey: {
          id: "11111111-1111-4111-8111-111111111111",
          active: true,
          ...input,
          partenaireNom: input.partenaireNom,
        },
        rawKey: "sk_test_secret",
      }),
    ),
    listForOrg: jest.fn().mockResolvedValue([]),
    revoke: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<ApiKeyService>;
  const billing = {
    getActivePlanForOrg: jest
      .fn()
      .mockResolvedValue({ code: opts.plan ?? "free" }),
  } as unknown as BillingService;
  const sms = {
    send: jest.fn().mockResolvedValue({ delivered: true }),
    isConfigured: () => true,
  } as unknown as jest.Mocked<SmsService>;
  const jwt = {
    sign: jest.fn().mockReturnValue("jwt"),
  } as unknown as JwtService;
  const config = { get: jest.fn() } as unknown as ConfigService;
  const service = new DeveloperService(
    accounts,
    organisations,
    keysRepo,
    apiKeys,
    billing,
    sms,
    jwt,
    config,
  );
  return { service, accounts, organisations, apiKeys, sms, qb, jwt };
}

describe("DeveloperService — clés d'API", () => {
  it("applique les limites de test quel que soit le tarif", async () => {
    const { service, apiKeys } = setup({ plan: "enterprise" });
    const before = Date.now();

    const key = await service.createKey(SESSION, {
      name: "Recette",
      mode: "test",
    });

    const input = apiKeys.create.mock.calls[0][0];
    expect(input).toEqual(
      expect.objectContaining({
        mode: "test",
        quotaPerHour: 100,
        quotaPerMonth: 2_000,
      }),
    );
    const expires = new Date(input.expiresAt as Date).getTime();
    expect(expires - before).toBeGreaterThanOrEqual(30 * DAY - 1000);
    expect(expires - before).toBeLessThanOrEqual(30 * DAY + 1000);
    expect(key.rawKey).toBe("sk_test_secret");
  });

  it("fixe les quotas de production selon le tarif", async () => {
    const { service, apiKeys } = setup({ plan: "pro" });

    await service.createKey(SESSION, {
      name: "Prod",
      mode: "live",
      expiresInDays: 365,
    });

    expect(apiKeys.create.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        mode: "live",
        quotaPerHour: 5_000,
        quotaPerMonth: 200_000,
      }),
    );
  });

  it("refuse une validité supérieure au plafond du tarif", async () => {
    const { service, apiKeys } = setup({ plan: "free" });

    await expect(
      service.createKey(SESSION, {
        name: "Prod",
        mode: "live",
        expiresInDays: 91,
      }),
    ).rejects.toThrow(/90 jours/);
    expect(apiKeys.create).not.toHaveBeenCalled();
  });

  it("refuse au-delà du nombre maximal de clés actives", async () => {
    const { service } = setup({ activeKeys: DEFAULT_KEY_POLICY.maxActiveKeys });

    await expect(
      service.createKey(SESSION, { name: "x", mode: "test" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("révoque dans le périmètre de l'organisation du développeur", async () => {
    const { service, apiKeys } = setup();

    await service.revokeKey(SESSION, "key-id");

    expect(apiKeys.revoke).toHaveBeenCalledWith("key-id", ORG);
  });
});

describe("DeveloperService — comptes", () => {
  it("inscrit un compte non vérifié et envoie un code par SMS", async () => {
    const { service, accounts, sms } = setup();
    accounts.findOne.mockResolvedValue(null);

    const res = await service.signup({
      name: "Awa",
      email: "awa@agritech.sn",
      password: "motdepasse-solide",
      phone: "77 123 45 67",
    });

    expect(res).toEqual({ verificationRequired: true, phone: "+22177****67" });
    const saved = accounts.save.mock.calls[0][0] as DeveloperAccount;
    expect(saved.phone).toBe("+221771234567");
    expect(await bcrypt.compare("motdepasse-solide", saved.passwordHash)).toBe(
      true,
    );
    expect(sms.send).toHaveBeenCalledWith(
      "+221771234567",
      expect.stringMatching(/\d{6}/),
    );
  });

  it("signale un SMS de vérification non envoyé", async () => {
    const { service, accounts, sms } = setup();
    accounts.findOne.mockResolvedValue(null);
    sms.send.mockResolvedValue({
      delivered: false,
      provider: "orange",
      error: "quota",
    });

    await expect(
      service.signup({
        name: "Awa",
        email: "awa@agritech.sn",
        password: "motdepasse-solide",
        phone: "+221771234567",
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("refuse une inscription sur une adresse déjà vérifiée", async () => {
    const { service, accounts } = setup();
    accounts.findOne.mockResolvedValue({
      verifiedAt: new Date(),
    } as DeveloperAccount);

    await expect(
      service.signup({
        name: "Awa",
        email: "a@b.sn",
        password: "motdepasse-solide",
        phone: "+221770000000",
      }),
    ).rejects.toThrow(/existe déjà/);
  });

  it("crée l'organisation et ouvre la session au bon code", async () => {
    const { service, qb, organisations, jwt } = setup();
    qb.getOne.mockResolvedValue({
      id: "acc-1",
      email: "a@b.sn",
      name: "Awa",
      company: "AgriTech",
      phone: "+221770000000",
      otpHash: await bcrypt.hash("123456", 4),
      otpExpiresAt: new Date(Date.now() + 60_000),
      otpAttempts: 0,
    });

    const res = await service.verify("a@b.sn", "123456");

    expect(organisations.save).toHaveBeenCalledWith(
      expect.objectContaining({ nom: "AgriTech" }),
    );
    expect(jwt.sign).toHaveBeenCalledWith(
      { sub: "acc-1", org: ORG },
      expect.objectContaining({ audience: "petalia-developer" }),
    );
    expect(res.token).toBe("jwt");
  });

  it("compte les essais de code erronés", async () => {
    const { service, qb, accounts } = setup();
    qb.getOne.mockResolvedValue({
      id: "acc-1",
      otpHash: await bcrypt.hash("123456", 4),
      otpExpiresAt: new Date(Date.now() + 60_000),
      otpAttempts: 2,
    });

    await expect(service.verify("a@b.sn", "000000")).rejects.toThrow(/2 essai/);
    expect(accounts.increment).toHaveBeenCalledWith(
      { id: "acc-1" },
      "otpAttempts",
      1,
    );
  });

  it("bloque la connexion d'un compte non vérifié et renvoie un code", async () => {
    const { service, qb, sms } = setup();
    qb.getOne.mockResolvedValue({
      id: "acc-1",
      phone: "+221770000000",
      passwordHash: await bcrypt.hash("motdepasse-solide", 4),
      failedLogins: 0,
      verifiedAt: null,
    });

    await expect(
      service.login({ email: "a@b.sn", password: "motdepasse-solide" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(sms.send).toHaveBeenCalled();
  });

  it("verrouille le compte après 5 échecs de mot de passe", async () => {
    const { service, qb, accounts } = setup();
    qb.getOne.mockResolvedValue({
      id: "acc-1",
      passwordHash: await bcrypt.hash("motdepasse-solide", 4),
      failedLogins: 4,
      verifiedAt: new Date(),
      organisationId: ORG,
    });

    await expect(
      service.login({ email: "a@b.sn", password: "faux" }),
    ).rejects.toThrow(/incorrect/);
    expect(accounts.update).toHaveBeenCalledWith(
      "acc-1",
      expect.objectContaining({
        failedLogins: 0,
        lockedUntil: expect.any(Date),
      }),
    );
  });
});

describe("politique de clés", () => {
  it("lit une surcharge partielle depuis l'environnement", () => {
    const policy = loadKeyPolicy(
      '{"live":{"pro":{"quotaPerHour":8000}},"maxActiveKeys":20}',
    );
    expect(limitsFor(policy, "live", "pro").quotaPerHour).toBe(8000);
    expect(limitsFor(policy, "live", "pro").quotaPerMonth).toBe(200_000);
    expect(policy.maxActiveKeys).toBe(20);
  });

  it("ignore une surcharge invalide", () => {
    expect(loadKeyPolicy("{pas du json")).toBe(DEFAULT_KEY_POLICY);
    expect(loadKeyPolicy('{"test":{"maxDays":-1}}')).toBe(DEFAULT_KEY_POLICY);
    expect(loadKeyPolicy('{"test":{"defaultDays":60}}')).toBe(
      DEFAULT_KEY_POLICY,
    );
  });
});

describe("téléphone", () => {
  it.each([
    ["77 123 45 67", "+221771234567"],
    ["0771234567", "+221771234567"],
    ["+33 6 12 34 56 78", "+33612345678"],
  ])("%s → %s", (raw, expected) => expect(normalizePhone(raw)).toBe(expected));

  it("masque le numéro", () =>
    expect(maskPhone("+221771234567")).toBe("+22177****67"));
});
