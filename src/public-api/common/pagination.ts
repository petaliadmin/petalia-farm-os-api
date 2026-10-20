import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { ObjectLiteral, SelectQueryBuilder } from "typeorm";
import { ProblemException } from "./problem";

export class ListQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: "Valeur `next_cursor` de la page précédente.",
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export interface ListEnvelope<T> {
  object: "list";
  url: string;
  data: T[];
  has_more: boolean;
  next_cursor: string | null;
}

interface CursorPayload {
  /** Sort key as epoch milliseconds. */
  t: number;
  id: string;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeCursor(cursor: string): CursorPayload {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as CursorPayload;
    if (
      typeof parsed?.t === "number" &&
      Number.isFinite(parsed.t) &&
      typeof parsed?.id === "string" &&
      /^[0-9a-f-]{36}$/i.test(parsed.id)
    ) {
      return parsed;
    }
  } catch {
    // fall through
  }
  throw new ProblemException("invalid_cursor");
}

/**
 * Keyset pagination, newest first, on (column, id). The column is truncated
 * to milliseconds so the cursor (built from a JS Date) compares exactly with
 * Postgres' microsecond timestamps.
 */
export async function paginate<T extends ObjectLiteral & { id: string }>(
  qb: SelectQueryBuilder<T>,
  query: ListQueryDto,
  options: { column?: keyof T & string } = {},
): Promise<{ rows: T[]; hasMore: boolean; nextCursor: string | null }> {
  const alias = qb.alias;
  const column = options.column ?? "createdAt";
  const sortExpr = `date_trunc('milliseconds', "${alias}"."${column}")`;
  const limit = query.limit ?? 20;

  if (query.cursor) {
    const c = decodeCursor(query.cursor);
    qb.andWhere(`(${sortExpr}, "${alias}"."id") < (:cursorT, :cursorId)`, {
      cursorT: new Date(c.t),
      cursorId: c.id,
    });
  }

  const rows = await qb
    .orderBy(sortExpr, "DESC")
    .addOrderBy(`"${alias}"."id"`, "DESC")
    .limit(limit + 1)
    .getMany();

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return {
    rows: page,
    hasMore,
    nextCursor:
      hasMore && last
        ? encodeCursor({
            t: (last[column] as unknown as Date).getTime(),
            id: last.id,
          })
        : null,
  };
}

export function listEnvelope<T>(
  url: string,
  data: T[],
  page: { hasMore: boolean; nextCursor: string | null },
): ListEnvelope<T> {
  return {
    object: "list",
    url,
    data,
    has_more: page.hasMore,
    next_cursor: page.nextCursor,
  };
}
