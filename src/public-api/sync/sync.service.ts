import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ObjectLiteral, Repository } from "typeorm";
import { Parcelle } from "../../parcelles/entities/parcelle.entity";
import { PublicClient } from "../common/context";
import { encodeId, PublicObject } from "../common/ids";
import {
  presentCropCycle,
  presentDevice,
  presentFarm,
  presentFarmer,
  presentParcel,
} from "../common/presenters";
import { ProblemException } from "../common/problem";
import {
  SYNC_RESOURCES,
  SyncQueryDto,
  SyncResource,
} from "../dto/platform.dto";
import { CropCycle } from "../entities/crop-cycle.entity";
import { Device } from "../entities/device.entity";
import { Farm } from "../entities/farm.entity";
import { Farmer } from "../entities/farmer.entity";

/** Per-resource watermark: last (updatedAt ms, id) delivered to the client. */
type Watermarks = Partial<Record<SyncResource, { t: number; id: string }>>;

interface ResourceDef {
  object: PublicObject;
  repo: Repository<ObjectLiteral>;
  present: (row: never) => Record<string, unknown>;
  isDeleted: (row: Record<string, unknown>) => boolean;
}

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

/**
 * Offline-first sync for field apps (2G/3G, days without network). The
 * client keeps the returned cursor and calls again until has_more = false;
 * the next session resumes from the same cursor and only gets changes,
 * deletions included as tombstones. Covers the caller's own organisation.
 */
@Injectable()
export class SyncService {
  private readonly resources: Record<SyncResource, ResourceDef>;

  constructor(
    @InjectRepository(Farmer) farmers: Repository<Farmer>,
    @InjectRepository(Farm) farms: Repository<Farm>,
    @InjectRepository(Parcelle) parcels: Repository<Parcelle>,
    @InjectRepository(CropCycle) cycles: Repository<CropCycle>,
    @InjectRepository(Device) devices: Repository<Device>,
  ) {
    const softDeleted = (row: Record<string, unknown>) =>
      Boolean(row.deletedAt);
    this.resources = {
      farmers: {
        object: "farmer",
        repo: farmers,
        present: presentFarmer as never,
        isDeleted: softDeleted,
      },
      farms: {
        object: "farm",
        repo: farms,
        present: presentFarm as never,
        isDeleted: softDeleted,
      },
      parcels: {
        object: "parcel",
        repo: parcels,
        present: presentParcel as never,
        isDeleted: (row) => row.deleted === true,
      },
      crop_cycles: {
        object: "crop_cycle",
        repo: cycles,
        present: presentCropCycle as never,
        isDeleted: () => false,
      },
      devices: {
        object: "device",
        repo: devices,
        present: presentDevice as never,
        isDeleted: softDeleted,
      },
    };
  }

  async changes(client: PublicClient, query: SyncQueryDto) {
    const wanted = this.parseResources(query.resources);
    const watermarks = query.cursor ? this.decode(query.cursor) : {};
    let budget = query.limit ?? 200;
    let hasMore = false;
    const data: Record<string, unknown>[] = [];

    for (const name of wanted) {
      const def = this.resources[name];
      const mark = watermarks[name] ?? { t: 0, id: ZERO_UUID };
      if (budget === 0) {
        hasMore = true;
        break;
      }
      const sortExpr = `date_trunc('milliseconds', "r"."updatedAt")`;
      const rows = await def.repo
        .createQueryBuilder("r")
        .where('"r"."organisationId" = :org AND "r"."livemode" = :lm', {
          org: client.organizationId,
          lm: client.livemode,
        })
        .andWhere(`(${sortExpr}, "r"."id") > (:t, :id)`, {
          t: new Date(mark.t),
          id: mark.id,
        })
        .orderBy(sortExpr, "ASC")
        .addOrderBy('"r"."id"', "ASC")
        .limit(budget + 1)
        .getMany();

      const page = rows.slice(0, budget);
      if (rows.length > budget) hasMore = true;
      for (const row of page) {
        data.push(
          def.isDeleted(row)
            ? {
                object: def.object,
                id: encodeId(def.object, row.id as string),
                deleted: true,
              }
            : { ...def.present(row as never), deleted: false },
        );
      }
      const last = page[page.length - 1];
      if (last) {
        watermarks[name] = {
          t: (last.updatedAt as Date).getTime(),
          id: last.id as string,
        };
      }
      budget -= page.length;
    }

    return {
      object: "sync_page" as const,
      resources: wanted,
      data,
      has_more: hasMore,
      // Always returned: store it and send it back on the next sync.
      next_cursor: this.encode(watermarks),
      server_time: new Date().toISOString(),
    };
  }

  private parseResources(raw?: string): SyncResource[] {
    if (!raw) return [...SYNC_RESOURCES];
    const names = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const unknown = names.find(
      (n) => !(SYNC_RESOURCES as readonly string[]).includes(n),
    );
    if (unknown) {
      throw new ProblemException("validation_failed", {
        errors: [
          {
            field: "resources",
            code: "invalid",
            message: `unknown resource ${unknown}`,
          },
        ],
      });
    }
    // Canonical order keeps parents (farmers) before children (parcels).
    return SYNC_RESOURCES.filter((r) => names.includes(r));
  }

  private encode(w: Watermarks): string {
    return Buffer.from(JSON.stringify({ v: 1, w })).toString("base64url");
  }

  private decode(cursor: string): Watermarks {
    try {
      const parsed = JSON.parse(
        Buffer.from(cursor, "base64url").toString("utf8"),
      );
      if (parsed?.v === 1 && parsed.w && typeof parsed.w === "object") {
        const out: Watermarks = {};
        for (const [k, v] of Object.entries(
          parsed.w as Record<string, { t: number; id: string }>,
        )) {
          if (
            (SYNC_RESOURCES as readonly string[]).includes(k) &&
            typeof v?.t === "number" &&
            /^[0-9a-f-]{36}$/i.test(v?.id ?? "")
          ) {
            out[k as SyncResource] = { t: v.t, id: v.id };
          }
        }
        return out;
      }
    } catch {
      // fall through
    }
    throw new ProblemException("invalid_cursor");
  }
}
