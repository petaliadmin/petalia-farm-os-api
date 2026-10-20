import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export const SIGNATURE_HEADER = "Petalia-Signature";
export const DEFAULT_TOLERANCE_SECONDS = 300;

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

/** Petalia-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "t.payload")> */
export function signPayload(
  secret: string,
  payload: string,
  timestamp = Math.floor(Date.now() / 1000),
): string {
  const v1 = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

/**
 * Reference verification for integrators (mirrored in the docs and SDKs).
 * Rejects signatures older than `toleranceSeconds` to stop replays.
 */
export function verifySignature(
  secret: string,
  payload: string,
  header: string,
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
  now = Math.floor(Date.now() / 1000),
): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.trim().split("=", 2) as [string, string]),
  );
  const t = Number(parts.t);
  if (!Number.isInteger(t) || !parts.v1) return false;
  if (Math.abs(now - t) > toleranceSeconds) return false;
  const expected = signPayload(secret, payload, t).split("v1=")[1];
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(parts.v1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
