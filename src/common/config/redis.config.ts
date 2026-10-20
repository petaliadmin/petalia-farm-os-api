type Env = (key: string) => string | undefined;

export interface RedisConnection {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: Record<string, never>;
}

/**
 * Redis connection shared by Bull and the cache store.
 *
 * REDIS_URL (Upstash: rediss://default:<token>@<host>:6379) takes precedence;
 * rediss:// — or any *.upstash.io host, which only accepts TLS — turns TLS
 * on. Otherwise REDIS_HOST / REDIS_PORT / REDIS_PASSWORD (AWS, Docker) apply
 * as before.
 */
export function redisConnection(env: Env): RedisConnection {
  const raw = env("REDIS_URL");
  if (raw) {
    const u = parseRedisUrl(raw);
    const tls = u.protocol === "rediss:" || u.hostname.endsWith(".upstash.io");
    return {
      host: u.hostname,
      port: parseInt(u.port || "6379", 10),
      username: decodeURIComponent(u.username) || undefined,
      password: decodeURIComponent(u.password) || undefined,
      ...(tls ? { tls: {} } : {}),
    };
  }
  return {
    host: env("REDIS_HOST") || "localhost",
    port: parseInt(env("REDIS_PORT") || "6379", 10),
    password: env("REDIS_PASSWORD") || undefined,
  };
}

/**
 * Tolerates what dashboards tend to hand out: surrounding quotes or spaces,
 * or a whole `redis-cli --tls -u redis://…` command. The error never echoes
 * the value, which contains the password.
 */
function parseRedisUrl(raw: string): URL {
  const match = raw.match(/rediss?:\/\/[^\s'"]+/);
  try {
    if (!match) throw new Error();
    return new URL(match[0]);
  } catch {
    throw new Error(
      "REDIS_URL is not a valid Redis URL — expected rediss://default:<password>@<host>:6379",
    );
  }
}
