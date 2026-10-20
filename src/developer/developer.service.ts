import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { IsNull, Repository } from "typeorm";
import { BillingService } from "../billing/billing.service";
import { PlanCode } from "../billing/entities/plan.entity";
import { Organisation } from "../organisations/entities/organisation.entity";
import { ApiKeyService } from "../partner/api-key.service";
import { ApiKey } from "../partner/entities/api-key.entity";
import { encodeId } from "../public-api/common/ids";
import { PUBLIC_SCOPES } from "../public-api/public-api.constants";
import { SmsService } from "../sms/sms.service";
import { DEVELOPER_AUDIENCE, DeveloperSession } from "./developer-auth.guard";
import { KeyPolicy, limitsFor, loadKeyPolicy } from "./developer-key-policy";
import {
  CreateDeveloperKeyDto,
  LoginDto,
  SignupDto,
} from "./dto/developer.dto";
import { DeveloperAccount } from "./entities/developer-account.entity";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const LOGIN_MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * Hash factice : la connexion compare toujours un mot de passe, compte existant
 * ou non. Calculé au premier besoin pour ne pas ralentir les démarrages à froid.
 */
let dummyHash: Promise<string> | undefined;
const getDummyHash = () =>
  (dummyHash ??= bcrypt.hash("petalia-developer-dummy", 12));

/** Résultat d'une vérification ou d'une connexion réussie. */
export interface DeveloperTokenResponse {
  token: string;
  expiresIn: number;
  account: ReturnType<typeof presentAccount>;
}

/**
 * Espace développeur en libre-service :
 *   - inscription (e-mail + mot de passe), vérification du téléphone par SMS ;
 *   - à la vérification : création d'une organisation (tarif free) ;
 *   - génération de clés d'API avec expiration obligatoire et quotas
 *     imposés par le mode (test / live) et le tarif de l'organisation.
 */
@Injectable()
export class DeveloperService {
  private readonly logger = new Logger(DeveloperService.name);
  readonly policy: KeyPolicy;
  private readonly tokenTtlSeconds = 2 * 60 * 60;
  /**
   * Mode démonstration (DEVELOPER_SMS_MODE=demo) : aucun SMS n'est envoyé, le
   * code est renvoyé dans la réponse (demoCode) et affiché par le portail.
   * Provisoire, tant que l'envoi de SMS n'est pas opérationnel : le numéro
   * n'est alors pas réellement vérifié.
   */
  private readonly demoCodes: boolean;

  constructor(
    @InjectRepository(DeveloperAccount)
    private readonly accounts: Repository<DeveloperAccount>,
    @InjectRepository(Organisation)
    private readonly organisations: Repository<Organisation>,
    @InjectRepository(ApiKey)
    private readonly keysRepo: Repository<ApiKey>,
    private readonly apiKeys: ApiKeyService,
    private readonly billing: BillingService,
    private readonly sms: SmsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.policy = loadKeyPolicy(config.get<string>("DEVELOPER_KEY_POLICY"));
    this.demoCodes = config.get<string>("DEVELOPER_SMS_MODE") === "demo";
    if (this.demoCodes) {
      this.logger.warn(
        "DEVELOPER_SMS_MODE=demo : codes de vérification renvoyés à l'écran, aucun SMS envoyé",
      );
    }
  }

  // ---------- Inscription et connexion ----------

  async signup(dto: SignupDto) {
    const phone = normalizePhone(dto.phone);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    let account = await this.findByEmail(dto.email);

    if (account?.verifiedAt) {
      throw new ConflictException(
        "Un compte existe déjà avec cette adresse : connectez-vous.",
      );
    }
    // Compte non vérifié : on reprend l'inscription avec les nouvelles informations
    account = this.accounts.create({
      ...(account ?? {}),
      email: dto.email,
      name: dto.name,
      company: dto.company ?? null,
      phone,
      passwordHash,
      otpAttempts: 0,
    });
    account = await this.accounts.save(account);
    const demoCode = await this.sendCode(account, true);
    return { verificationRequired: true, phone: maskPhone(phone), demoCode };
  }

  async resend(email: string) {
    const account = await this.findByEmail(email);
    // Réponse identique si le compte n'existe pas ou est déjà vérifié (pas d'énumération)
    const demoCode =
      account && !account.verifiedAt
        ? await this.sendCode(account, false)
        : undefined;
    return { sent: true, demoCode };
  }

  async verify(email: string, code: string): Promise<DeveloperTokenResponse> {
    const account = await this.accounts
      .createQueryBuilder("a")
      .addSelect("a.otpHash")
      .where("a.email = :email", { email })
      .getOne();
    if (
      !account ||
      account.verifiedAt ||
      !account.otpHash ||
      !account.otpExpiresAt
    ) {
      throw new BadRequestException(
        "Aucune vérification en attente pour cette adresse.",
      );
    }
    if (account.otpExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Code expiré : demandez-en un nouveau.");
    }
    if (account.otpAttempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException(
        "Trop d’essais : demandez un nouveau code.",
      );
    }
    if (!(await bcrypt.compare(code, account.otpHash))) {
      await this.accounts.increment({ id: account.id }, "otpAttempts", 1);
      const left = OTP_MAX_ATTEMPTS - account.otpAttempts - 1;
      throw new BadRequestException(
        `Code incorrect (${left} essai(s) restant(s)).`,
      );
    }

    // Réservation atomique : deux vérifications simultanées ne créent pas deux organisations
    const verifiedAt = new Date();
    const claim = await this.accounts.update(
      { id: account.id, verifiedAt: IsNull() },
      { verifiedAt },
    );
    if (!claim.affected) {
      throw new BadRequestException("Compte déjà vérifié : connectez-vous.");
    }

    const organisation = await this.organisations.save(
      this.organisations.create({
        nom: account.company || `${account.name} (développeur)`,
        type: "autre",
        pays: "SN",
        telephone: account.phone,
        actif: true,
      }),
    );
    await this.accounts.update(account.id, {
      organisationId: organisation.id,
      otpHash: null,
      otpExpiresAt: null,
      otpAttempts: 0,
      lastLoginAt: new Date(),
    });
    this.logger.log(
      `Compte développeur ${account.id} vérifié, organisation ${organisation.id}`,
    );
    return this.session({
      ...account,
      organisationId: organisation.id,
      verifiedAt,
    });
  }

  async login(dto: LoginDto): Promise<DeveloperTokenResponse> {
    const account = await this.accounts
      .createQueryBuilder("a")
      .addSelect("a.passwordHash")
      .where("a.email = :email", { email: dto.email })
      .getOne();
    // Comparaison effectuée même sans compte : temps de réponse identique
    const hash = account?.passwordHash ?? (await getDummyHash());
    const passwordOk = await bcrypt.compare(dto.password, hash);

    if (account?.lockedUntil && account.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException(
        "Compte temporairement bloqué : réessayez dans 15 minutes.",
      );
    }
    if (!account || !passwordOk) {
      if (account) {
        const failures = account.failedLogins + 1;
        await this.accounts.update(account.id, {
          failedLogins: failures >= LOGIN_MAX_FAILURES ? 0 : failures,
          lockedUntil:
            failures >= LOGIN_MAX_FAILURES
              ? new Date(Date.now() + LOCK_MS)
              : null,
        });
      }
      throw new UnauthorizedException("E-mail ou mot de passe incorrect.");
    }
    if (!account.verifiedAt || !account.organisationId) {
      // Un code récent reste valable : le délai entre deux envois n'empêche pas la réponse 403
      // En démonstration, un nouveau code est toujours émis pour pouvoir l'afficher
      const demoCode = await this.sendCode(account, this.demoCodes).catch(
        (e) => {
          if (!(e instanceof BadRequestException)) throw e;
          return undefined;
        },
      );
      throw new ForbiddenException({
        statusCode: 403,
        code: "verification_required",
        message: demoCode
          ? "Vérifiez votre numéro avec le code de démonstration affiché."
          : "Vérifiez votre numéro : un code vient de vous être envoyé par SMS.",
        demoCode,
      });
    }
    await this.accounts.update(account.id, {
      failedLogins: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    });
    return this.session(account);
  }

  async me(session: DeveloperSession) {
    const account = await this.accounts.findOne({
      where: { id: session.accountId },
    });
    if (!account) throw new UnauthorizedException("Compte introuvable");
    const plan = await this.planOf(session.organisationId);
    return {
      account: presentAccount(account),
      plan,
      limits: {
        test: this.policy.test,
        live: limitsFor(this.policy, "live", plan),
        grid: this.policy.live,
        maxActiveKeys: this.policy.maxActiveKeys,
      },
      scopes: PUBLIC_SCOPES,
    };
  }

  // ---------- Clés d'API ----------

  async listKeys(session: DeveloperSession) {
    await this.syncLiveQuotas(session.organisationId);
    const keys = await this.apiKeys.listForOrg(session.organisationId);
    return { data: keys.map(presentKey) };
  }

  async createKey(session: DeveloperSession, dto: CreateDeveloperKeyDto) {
    const plan = await this.planOf(session.organisationId);
    const limits = limitsFor(this.policy, dto.mode, plan);
    const days = dto.expiresInDays ?? limits.defaultDays;
    if (days > limits.maxDays) {
      throw new BadRequestException(
        `Validité maximale pour une clé ${dto.mode === "test" ? "de test" : `de production (tarif ${plan})`} : ${limits.maxDays} jours.`,
      );
    }
    const active = await this.keysRepo
      .createQueryBuilder("k")
      .where("k.organisationId = :org AND k.active = true", {
        org: session.organisationId,
      })
      .andWhere("(k.expiresAt IS NULL OR k.expiresAt > NOW())")
      .getCount();
    if (active >= this.policy.maxActiveKeys) {
      throw new BadRequestException(
        `Limite de ${this.policy.maxActiveKeys} clés actives atteinte : révoquez une clé inutilisée.`,
      );
    }

    const { apiKey, rawKey } = await this.apiKeys.create({
      organisationId: session.organisationId,
      partenaireNom: dto.name,
      scopes: dto.scopes?.length ? dto.scopes : [...PUBLIC_SCOPES],
      mode: dto.mode,
      kind: dto.kind ?? "secret",
      quotaPerHour: limits.quotaPerHour,
      quotaPerMonth: limits.quotaPerMonth,
      expiresAt: new Date(Date.now() + days * DAY_MS),
    });
    this.logger.log(
      `Clé ${apiKey.id} (${dto.mode}) créée pour l'organisation ${session.organisationId}`,
    );
    return {
      ...presentKey(apiKey),
      rawKey,
      warning:
        "Copiez cette clé maintenant : elle ne sera plus jamais affichée.",
    };
  }

  async revokeKey(session: DeveloperSession, id: string) {
    await this.apiKeys.revoke(id, session.organisationId);
    return { revoked: true };
  }

  // ---------- Interne ----------

  /** Aligne les quotas des clés de production sur le tarif actuel (montée ou baisse de gamme). */
  private async syncLiveQuotas(organisationId: string): Promise<void> {
    const limits = limitsFor(
      this.policy,
      "live",
      await this.planOf(organisationId),
    );
    await this.keysRepo
      .createQueryBuilder()
      .update(ApiKey)
      .set({
        quotaPerHour: limits.quotaPerHour,
        quotaPerMonth: limits.quotaPerMonth,
      })
      .where({ organisationId, mode: "live", active: true })
      .andWhere('("quotaPerHour" <> :h OR "quotaPerMonth" <> :m)', {
        h: limits.quotaPerHour,
        m: limits.quotaPerMonth,
      })
      .execute();
  }

  private async planOf(organisationId: string): Promise<PlanCode> {
    try {
      return (await this.billing.getActivePlanForOrg(organisationId)).code;
    } catch {
      return "free";
    }
  }

  private findByEmail(email: string) {
    return this.accounts.findOne({ where: { email } });
  }

  /** Émet un code ; renvoie sa valeur uniquement en mode démonstration. */
  private async sendCode(
    account: DeveloperAccount,
    force: boolean,
  ): Promise<string | undefined> {
    if (
      !force &&
      account.otpSentAt &&
      Date.now() - account.otpSentAt.getTime() < OTP_RESEND_MS
    ) {
      throw new BadRequestException(
        "Patientez une minute avant de demander un nouveau code.",
      );
    }
    if (
      !this.demoCodes &&
      this.config.get("NODE_ENV") === "production" &&
      !this.sms.isConfigured()
    ) {
      throw new ServiceUnavailableException(
        "Vérification par SMS indisponible : contactez l’équipe Petalia.",
      );
    }
    const code = randomInt(100000, 1000000).toString();
    await this.accounts.update(account.id, {
      otpHash: await bcrypt.hash(code, 8),
      otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
      otpSentAt: new Date(),
      otpAttempts: 0,
    });
    if (this.demoCodes) return code;
    const sent = await this.sms.send(
      account.phone,
      `Petalia Développeurs : votre code de vérification est ${code}. Valable 10 min.`,
    );
    if (!sent.delivered) {
      this.logger.error(
        `SMS de vérification non envoyé à ${maskPhone(account.phone)} : ${sent.error}`,
      );
      throw new ServiceUnavailableException(
        "Le SMS de vérification n’a pas pu être envoyé : réessayez dans quelques minutes.",
      );
    }
    if (
      this.config.get("NODE_ENV") !== "production" &&
      !this.sms.isConfigured()
    ) {
      this.logger.warn(
        `[DEV] code de vérification pour ${account.email} : ${code}`,
      );
    }
    return undefined;
  }

  private session(account: DeveloperAccount): DeveloperTokenResponse {
    if (!account.organisationId)
      throw new NotFoundException("Organisation manquante");
    const token = this.jwt.sign(
      { sub: account.id, org: account.organisationId },
      { audience: DEVELOPER_AUDIENCE, expiresIn: this.tokenTtlSeconds },
    );
    return {
      token,
      expiresIn: this.tokenTtlSeconds,
      account: presentAccount(account),
    };
  }
}

function presentAccount(a: DeveloperAccount) {
  return {
    id: a.id,
    email: a.email,
    name: a.name,
    company: a.company,
    phone: maskPhone(a.phone),
    organisationId: a.organisationId
      ? encodeId("organization", a.organisationId)
      : null,
    verified: !!a.verifiedAt,
    createdAt: a.createdAt,
  };
}

function presentKey(k: ApiKey) {
  const expired =
    !!k.expiresAt && new Date(k.expiresAt).getTime() <= Date.now();
  return {
    id: k.id,
    clientId: encodeId("api_key", k.id),
    name: k.partenaireNom,
    prefix: k.prefix,
    mode: k.mode,
    kind: k.kind,
    scopes: k.scopes,
    quotaPerHour: k.quotaPerHour,
    quotaPerMonth: k.quotaPerMonth,
    expiresAt: k.expiresAt,
    lastUsedAt: k.lastUsedAt,
    createdAt: k.createdAt,
    status: !k.active ? "revoked" : expired ? "expired" : "active",
  };
}

/** E.164 ; les numéros locaux sénégalais reçoivent +221. */
export function normalizePhone(raw: string): string {
  const compact = raw.replace(/[\s-]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  return `+221${compact.replace(/^0/, "")}`;
}

export function maskPhone(phone: string): string {
  return phone.length > 8
    ? `${phone.slice(0, 6)}****${phone.slice(-2)}`
    : "****";
}
