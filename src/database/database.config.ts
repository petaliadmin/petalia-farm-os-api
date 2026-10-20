import { join } from "path";
import { DataSourceOptions } from "typeorm";
import { isServerless } from "../common/runtime";

type Env = (key: string) => string | undefined;

/**
 * Single source of truth for the Postgres connection, shared by the Nest app
 * (app.module.ts) and the TypeORM CLI (data-source.ts).
 *
 * Two ways to configure it:
 *   - DATABASE_URL (Supabase): postgres://user:pass@host:port/db.
 *     DATABASE_MIGRATION_URL is used by the CLI when set, because migrations
 *     need a session connection (Supabase direct or session pooler, port
 *     5432) while the app goes through the transaction pooler (port 6543).
 *   - DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME (AWS, Docker):
 *     unchanged behaviour.
 */
export function buildDataSourceOptions(
  env: Env,
  { forMigrations = false } = {},
): DataSourceOptions {
  const url = cleanUrl(
    (forMigrations && env("DATABASE_MIGRATION_URL")) || env("DATABASE_URL"),
  );
  const host = url ? new URL(url).hostname : env("DB_HOST") || "localhost";

  const connection = url
    ? { url }
    : {
        host,
        port: parseInt(env("DB_PORT") || "5432", 10),
        username: env("DB_USER") || "petalia",
        password: env("DB_PASSWORD") || "secret",
        database: env("DB_NAME") || "petalia",
      };

  // synchronize stays on in dev for the historical DB_* setup only: a
  // DATABASE_URL usually points at a shared (Supabase) database whose schema
  // is owned by migrations.
  const syncFlag = env("DB_SYNCHRONIZE");
  const synchronize =
    !forMigrations &&
    (syncFlag !== undefined
      ? syncFlag === "true"
      : !url && env("NODE_ENV") !== "production");

  const poolMax = parseInt(
    env("DB_POOL_MAX") || (isServerless() ? "3" : "10"),
    10,
  );

  return {
    type: "postgres",
    ...connection,
    ssl: sslOptions(env, host),
    extra: { max: poolMax, connectionTimeoutMillis: 10_000 },
    entities: [join(__dirname, "../**/*.entity{.ts,.js}")],
    migrations: forMigrations ? [join(__dirname, "migrations/*{.ts,.js}")] : [],
    synchronize,
    logging: env("NODE_ENV") === "development",
  };
}

/**
 * Tolerates surrounding quotes or spaces from a copy-paste. The error never
 * echoes the value, which contains the password.
 */
function cleanUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const url = raw.trim().replace(/^['"]|['"]$/g, "");
  try {
    new URL(url);
  } catch {
    throw new Error(
      "DATABASE_URL / DATABASE_MIGRATION_URL is not a valid URL — expected postgresql://<user>:<password>@<host>:<port>/postgres (URL-encode special characters in the password)",
    );
  }
  // Supabase's direct host only resolves to IPv6, which Vercel and GitHub
  // runners cannot reach: the connection just times out.
  if (/^db\.[a-z0-9]+\.supabase\.co$/.test(new URL(url).hostname)) {
    throw new Error(
      "DATABASE_URL points at Supabase's direct host (db.<ref>.supabase.co, IPv6 only) — use the pooler connection string (*.pooler.supabase.com) from Supabase → Connect",
    );
  }
  return url;
}

/**
 * DB_SSL=true|false overrides; otherwise TLS is on for Supabase hosts only.
 * DB_SSL_CA (PEM, from Supabase → Database settings → SSL) enables full
 * certificate verification; without it the link is encrypted but the server
 * certificate is not checked.
 */
function sslOptions(env: Env, host: string) {
  const flag = env("DB_SSL");
  const enabled =
    flag !== undefined ? flag === "true" : /\.supabase\.(co|com)$/.test(host);
  if (!enabled) return false;

  const ca = env("DB_SSL_CA");
  return ca
    ? { ca: ca.replace(/\\n/g, "\n"), rejectUnauthorized: true }
    : { rejectUnauthorized: false };
}
