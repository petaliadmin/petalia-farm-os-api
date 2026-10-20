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
 * the rediss:// scheme turns TLS on. Otherwise REDIS_HOST / REDIS_PORT /
 * REDIS_PASSWORD (AWS, Docker) apply as before.
 */
export function redisConnection(env: Env): RedisConnection {
  const url = env("REDIS_URL");
  if (url) {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: parseInt(u.port || "6379", 10),
      username: decodeURIComponent(u.username) || undefined,
      password: decodeURIComponent(u.password) || undefined,
      ...(u.protocol === "rediss:" ? { tls: {} } : {}),
    };
  }
  return {
    host: env("REDIS_HOST") || "localhost",
    port: parseInt(env("REDIS_PORT") || "6379", 10),
    password: env("REDIS_PASSWORD") || undefined,
  };
}
