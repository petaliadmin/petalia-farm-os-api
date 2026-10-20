import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { IsNull, Repository } from "typeorm";
import { Organisation } from "../../organisations/entities/organisation.entity";
import { SmsService } from "../../sms/sms.service";
import { PublicClient } from "../common/context";
import { decodeId, decodeRef } from "../common/ids";
import { listEnvelope, ListQueryDto, paginate } from "../common/pagination";
import { normalizePhone } from "../common/phone";
import { presentAccessLog, presentConsent } from "../common/presenters";
import { ProblemException } from "../common/problem";
import {
  ConfirmConsentDto,
  CreateConsentDto,
  ListConsentsQueryDto,
} from "../dto/platform.dto";
import { Consent } from "../entities/consent.entity";
import { DataAccessLog } from "../entities/data-access-log.entity";
import { Farmer } from "../entities/farmer.entity";
import { EventsService } from "../events/events.service";
import { CONSENTABLE_SCOPES, PublicScope } from "../public-api.constants";
import { AccessPolicy } from "./access-policy.service";

const OTP_TTL_MS = 15 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const DEFAULT_CONSENT_DAYS = 365;

const SCOPE_LABELS: Record<string, { fr: string; en: string }> = {
  "farmers:read": { fr: "votre profil", en: "your profile" },
  "parcels:read": { fr: "vos parcelles", en: "your plots" },
  "observations:read": {
    fr: "les mesures de vos champs",
    en: "your field measurements",
  },
  "notifications:write": {
    fr: "vous envoyer des messages",
    en: "send you messages",
  },
  "finance:read": { fr: "vos données financières", en: "your financial data" },
};

/**
 * Consent requests are confirmed by the farmer: a 6-digit code is texted to
 * their phone with the requester's name and purpose; the farmer hands the
 * code over only if they agree. Wolof/Pulaar SMS (and voice) templates come
 * with the USSD self-service flow; until then wo/ff farmers get French.
 */
@Injectable()
export class ConsentsService {
  private readonly logger = new Logger(ConsentsService.name);

  constructor(
    @InjectRepository(Consent) private readonly consents: Repository<Consent>,
    @InjectRepository(Farmer) private readonly farmers: Repository<Farmer>,
    @InjectRepository(DataAccessLog)
    private readonly logs: Repository<DataAccessLog>,
    @InjectRepository(Organisation)
    private readonly organisations: Repository<Organisation>,
    private readonly policy: AccessPolicy,
    private readonly sms: SmsService,
    private readonly events: EventsService,
  ) {}

  async create(client: PublicClient, dto: CreateConsentDto) {
    for (const scope of dto.scopes) {
      if (!CONSENTABLE_SCOPES.includes(scope as PublicScope)) {
        throw new ProblemException("scope_not_consentable", {
          params: { scope },
        });
      }
    }
    const farmer = await this.findFarmer(client, dto);
    if (farmer.organisationId === client.organizationId) {
      throw new ProblemException("validation_failed", {
        errors: [
          {
            field: "farmer",
            code: "already_delegate",
            message: "your organization already acts for this farmer",
          },
        ],
      });
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = dto.expires_at
      ? new Date(dto.expires_at)
      : new Date(Date.now() + DEFAULT_CONSENT_DAYS * 24 * 3600 * 1000);
    if (expiresAt.getTime() <= Date.now()) {
      throw new ProblemException("validation_failed", {
        errors: [{ field: "expires_at", code: "in_past" }],
      });
    }

    const consent = await this.consents.save(
      this.consents.create({
        livemode: client.livemode,
        farmerId: farmer.id,
        granteeOrganisationId: client.organizationId,
        requestedByApiKeyId: client.apiKeyId,
        scopes: [...new Set(dto.scopes)],
        purpose: dto.purpose,
        status: "pending",
        method: "sms_otp",
        otpHash: await bcrypt.hash(code, 8),
        otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
        expiresAt,
      }),
    );

    // Test mode never texts anyone: the code comes back in the response.
    if (!client.livemode) {
      return { ...presentConsent(consent), test_confirmation_code: code };
    }

    const grantee = await this.organisations.findOne({
      where: { id: client.organizationId },
    });
    const sent = await this.sms.send(
      farmer.phone,
      this.consentSms(
        farmer,
        grantee?.sigle || grantee?.nom || "Un partenaire",
        consent,
        code,
      ),
    );
    if (!sent.delivered) {
      await this.consents.delete(consent.id);
      throw new ProblemException("upstream_unavailable", {
        params: {
          reason: "SMS could not be delivered to the farmer; retry later.",
        },
      });
    }
    return presentConsent(consent);
  }

  async confirm(client: PublicClient, id: string, dto: ConfirmConsentDto) {
    const consent = await this.consents
      .createQueryBuilder("c")
      .addSelect("c.otpHash")
      .where("c.id = :id", { id: decodeId("consent", id) })
      .andWhere('c."granteeOrganisationId" = :org AND c.livemode = :lm', {
        org: client.organizationId,
        lm: client.livemode,
      })
      .getOne();
    if (!consent)
      throw new ProblemException("resource_missing", { params: { id } });
    if (consent.status !== "pending") {
      throw new ProblemException("consent_not_pending", {
        params: { status: consent.status },
      });
    }
    if (!consent.otpExpiresAt || consent.otpExpiresAt.getTime() < Date.now()) {
      await this.consents.update(consent.id, {
        status: "expired",
        otpHash: null,
      });
      throw new ProblemException("consent_invalid_code", {
        params: { remaining: 0 },
      });
    }

    const ok = await bcrypt.compare(dto.code, consent.otpHash ?? "");
    if (!ok) {
      const attempts = consent.otpAttempts + 1;
      const exhausted = attempts >= MAX_OTP_ATTEMPTS;
      await this.consents.update(consent.id, {
        otpAttempts: attempts,
        ...(exhausted && { status: "rejected", otpHash: null }),
      });
      throw new ProblemException("consent_invalid_code", {
        params: { remaining: MAX_OTP_ATTEMPTS - attempts },
      });
    }

    consent.status = "active";
    consent.grantedAt = new Date();
    consent.otpHash = null;
    const saved = await this.consents.save(consent);
    const body = presentConsent(saved);
    await this.notifyBothSides(saved, "consent.granted", body);
    return body;
  }

  async revoke(client: PublicClient, id: string) {
    const consent = await this.loadVisible(client, id);
    if (consent.status !== "pending" && consent.status !== "active") {
      throw new ProblemException("consent_not_pending", {
        params: { status: consent.status },
      });
    }
    consent.status = "revoked";
    consent.revokedAt = new Date();
    const saved = await this.consents.save(consent);
    const body = presentConsent(saved);
    await this.notifyBothSides(saved, "consent.revoked", body);
    return body;
  }

  async retrieve(client: PublicClient, id: string) {
    return presentConsent(await this.loadVisible(client, id));
  }

  /** Consents the caller received, plus those given by farmers it manages. */
  async list(client: PublicClient, query: ListConsentsQueryDto) {
    const qb = this.consents
      .createQueryBuilder("c")
      .where("c.livemode = :lm", { lm: client.livemode })
      .andWhere(
        `(c."granteeOrganisationId" = :org OR c."farmerId" IN (
          SELECT f.id FROM farmers f WHERE f."organisationId" = :org))`,
        { org: client.organizationId },
      );
    if (query.farmer) {
      qb.andWhere('c."farmerId" = :farmerId', {
        farmerId: decodeRef("farmer", query.farmer, "farmer"),
      });
    }
    if (query.status)
      qb.andWhere("c.status = :status", { status: query.status });
    const page = await paginate(qb, query);
    return listEnvelope("/v1/consents", page.rows.map(presentConsent), page);
  }

  /**
   * "Who read my data", for the farmer's delegate organisation to show the
   * farmer (app, USSD, field agent). Third parties never see this journal.
   */
  async accessLogs(
    client: PublicClient,
    farmerPublicId: string,
    query: ListQueryDto,
  ) {
    const { grant } = await this.policy.farmer(
      client,
      decodeId("farmer", farmerPublicId),
      "farmers:read",
      farmerPublicId,
    );
    if (grant.basis !== "delegate") {
      throw new ProblemException("resource_missing", {
        params: { id: farmerPublicId },
      });
    }
    const qb = this.logs
      .createQueryBuilder("l")
      .where('l."farmerId" = :farmerId AND l.livemode = :lm', {
        farmerId: decodeId("farmer", farmerPublicId),
        lm: client.livemode,
      });
    const page = await paginate(qb, query);
    return listEnvelope(
      `/v1/farmers/${farmerPublicId}/access_logs`,
      page.rows.map(presentAccessLog),
      page,
    );
  }

  private async findFarmer(
    client: PublicClient,
    dto: CreateConsentDto,
  ): Promise<Farmer> {
    if (!dto.farmer && !dto.farmer_phone) {
      throw new ProblemException("validation_failed", {
        errors: [
          {
            field: "farmer",
            code: "required",
            message: "farmer or farmer_phone",
          },
        ],
      });
    }
    const ref = dto.farmer ?? dto.farmer_phone!;
    const farmer = await this.farmers.findOne({
      where: {
        ...(dto.farmer
          ? { id: decodeRef("farmer", dto.farmer, "farmer") }
          : { phone: normalizePhone(dto.farmer_phone!, "farmer_phone") }),
        livemode: client.livemode,
        deletedAt: IsNull(),
      },
    });
    if (!farmer)
      throw new ProblemException("resource_missing", { params: { id: ref } });
    return farmer;
  }

  private async loadVisible(
    client: PublicClient,
    id: string,
  ): Promise<Consent> {
    const consent = await this.consents.findOne({
      where: { id: decodeId("consent", id), livemode: client.livemode },
    });
    if (consent) {
      if (consent.granteeOrganisationId === client.organizationId)
        return consent;
      const farmer = await this.farmers.findOne({
        where: { id: consent.farmerId },
      });
      if (farmer?.organisationId === client.organizationId) return consent;
    }
    throw new ProblemException("resource_missing", { params: { id } });
  }

  private async notifyBothSides(
    consent: Consent,
    type: "consent.granted" | "consent.revoked",
    body: Record<string, unknown>,
  ) {
    const farmer = await this.farmers.findOne({
      where: { id: consent.farmerId },
    });
    const orgs = new Set(
      [consent.granteeOrganisationId, farmer?.organisationId].filter(Boolean),
    );
    for (const org of orgs) {
      void this.events.emit(org as string, consent.livemode, type, body);
    }
  }

  private consentSms(
    farmer: Farmer,
    grantee: string,
    consent: Consent,
    code: string,
  ) {
    const lang = farmer.preferredLanguage === "en" ? "en" : "fr";
    const what = consent.scopes
      .map((s) => SCOPE_LABELS[s]?.[lang] ?? s)
      .join(", ");
    return lang === "en"
      ? `Petalia: ${grantee} asks to access ${what} to "${consent.purpose}". If you agree, give them this code: ${code} (valid 15 min). Otherwise ignore this SMS.`
      : `Petalia : ${grantee} demande l'accès à ${what} pour « ${consent.purpose} ». Si vous êtes d'accord, donnez-lui ce code : ${code} (valable 15 min). Sinon, ignorez ce SMS.`;
  }
}
