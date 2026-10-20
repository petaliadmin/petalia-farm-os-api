import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { PublicClient } from "../common/context";
import { ProblemException } from "../common/problem";
import { Consent } from "../entities/consent.entity";
import { DataAccessLog } from "../entities/data-access-log.entity";
import { Farmer } from "../entities/farmer.entity";
import { CONSENTABLE_SCOPES, PublicScope } from "../public-api.constants";

export interface Grant {
  basis: "delegate" | "consent";
  consentId: string | null;
}

export interface AccessEntry {
  farmerId: string;
  resourceType: string;
  resourceId?: string | null;
  action: "read" | "write";
  basis: Grant["basis"];
  consentId?: string | null;
}

let paramSeq = 0;

/**
 * Data sovereignty rules, in one place:
 *   - the farmer's delegate organisation (cooperative) acts for them;
 *   - any other organisation needs an active consent covering the scope;
 *   - test keys only ever see test data, live keys live data;
 *   - anything else is a 404, so ids of other farmers cannot be probed.
 * Every access to farmer data is journaled for the farmer ("who read my data").
 */
@Injectable()
export class AccessPolicy {
  private readonly logger = new Logger(AccessPolicy.name);

  constructor(
    @InjectRepository(Farmer) private readonly farmers: Repository<Farmer>,
    @InjectRepository(Consent) private readonly consents: Repository<Consent>,
    @InjectRepository(DataAccessLog)
    private readonly logs: Repository<DataAccessLog>,
  ) {}

  async grantFor(
    client: PublicClient,
    farmer: Pick<Farmer, "id" | "organisationId">,
    scope: PublicScope,
  ): Promise<Grant | null> {
    if (farmer.organisationId === client.organizationId) {
      return { basis: "delegate", consentId: null };
    }
    if (!CONSENTABLE_SCOPES.includes(scope)) return null;
    const consent = await this.consents
      .createQueryBuilder("c")
      .where('c."farmerId" = :farmerId', { farmerId: farmer.id })
      .andWhere('c."granteeOrganisationId" = :org', {
        org: client.organizationId,
      })
      .andWhere("c.status = 'active' AND c.livemode = :lm", {
        lm: client.livemode,
      })
      .andWhere("c.scopes @> :scope::jsonb", {
        scope: JSON.stringify([scope]),
      })
      .andWhere('(c."expiresAt" IS NULL OR c."expiresAt" > NOW())')
      .getOne();
    return consent ? { basis: "consent", consentId: consent.id } : null;
  }

  /**
   * Grant for a farmer-linked row (parcel, observation…): the row's own
   * organisation acts as delegate; otherwise the row's farmer must consent.
   */
  async rowGrant(
    client: PublicClient,
    row: { organisationId: string | null; livemode: boolean },
    farmerId: string | null,
    scope: PublicScope,
  ): Promise<Grant | null> {
    if (row.livemode !== client.livemode) return null;
    if (row.organisationId === client.organizationId) {
      return { basis: "delegate", consentId: null };
    }
    if (!farmerId) return null;
    return this.grantFor(client, { id: farmerId, organisationId: null }, scope);
  }

  /** Loads a farmer the client may use for `scope`, or throws 404. */
  async farmer(
    client: PublicClient,
    farmerId: string,
    scope: PublicScope,
    publicId: string,
  ): Promise<{ farmer: Farmer; grant: Grant }> {
    const farmer = await this.farmers.findOne({
      where: { id: farmerId, livemode: client.livemode, deletedAt: IsNull() },
    });
    const grant = farmer ? await this.grantFor(client, farmer, scope) : null;
    if (!farmer || !grant) {
      throw new ProblemException("resource_missing", {
        params: { id: publicId },
      });
    }
    return { farmer, grant };
  }

  /**
   * SQL predicate limiting a query to rows the client may see for `scope`:
   * its own rows, plus rows of farmers who consented to this scope.
   * `farmerIdSql` is an SQL expression yielding the row's farmer id.
   */
  visibility(
    alias: string,
    client: PublicClient,
    scope: PublicScope,
    farmerIdSql: string | null,
  ): { sql: string; params: Record<string, unknown> } {
    const n = ++paramSeq % 1_000_000;
    const params: Record<string, unknown> = {
      [`vOrg${n}`]: client.organizationId,
      [`vLm${n}`]: client.livemode,
      [`vScope${n}`]: JSON.stringify([scope]),
    };
    // parcelles.organisationId is varchar (legacy), new tables use uuid:
    // compare as text here and cast for consents, so the shared parameter
    // never gets inferred with the wrong type.
    const own = `"${alias}"."organisationId"::text = CAST(:vOrg${n} AS text)`;
    const live = `"${alias}"."livemode" = :vLm${n}`;
    if (!farmerIdSql || !CONSENTABLE_SCOPES.includes(scope)) {
      return { sql: `(${own} AND ${live})`, params };
    }
    const consented = `${farmerIdSql} IN (
      SELECT c."farmerId" FROM consents c
      WHERE c."granteeOrganisationId" = CAST(:vOrg${n} AS uuid)
        AND c.status = 'active' AND c.livemode = :vLm${n}
        AND c.scopes @> :vScope${n}::jsonb
        AND (c."expiresAt" IS NULL OR c."expiresAt" > NOW()))`;
    return { sql: `((${own} OR ${consented}) AND ${live})`, params };
  }

  /** Journals accesses; never fails the request. */
  record(client: PublicClient, requestId: string, entries: AccessEntry[]) {
    const unique = new Map<string, AccessEntry>();
    for (const e of entries) {
      unique.set(
        `${e.farmerId}|${e.resourceType}|${e.resourceId ?? ""}|${e.action}`,
        e,
      );
    }
    if (!unique.size) return;
    void this.logs
      .insert(
        [...unique.values()].map((e) => ({
          livemode: client.livemode,
          farmerId: e.farmerId,
          organisationId: client.organizationId,
          apiKeyId: client.apiKeyId,
          action: e.action,
          resourceType: e.resourceType,
          resourceId: e.resourceId ?? null,
          basis: e.basis,
          consentId: e.consentId ?? null,
          requestId,
        })),
      )
      .catch((err: Error) =>
        this.logger.error(`access log insert failed: ${err.message}`),
      );
  }

  /** Basis of a list row, from its owning organisation. */
  basisOf(
    client: PublicClient,
    rowOrganisationId: string | null,
  ): Grant["basis"] {
    return rowOrganisationId === client.organizationId ? "delegate" : "consent";
  }
}
