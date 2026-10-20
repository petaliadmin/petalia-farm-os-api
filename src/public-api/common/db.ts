import { QueryFailedError } from "typeorm";

/** Postgres unique_violation, optionally on a given constraint/index. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError &&
    (err.driverError as { code?: string } | undefined)?.code === "23505"
  );
}
