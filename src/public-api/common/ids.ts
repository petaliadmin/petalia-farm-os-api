import { ProblemException } from "./problem";

/**
 * Public identifiers are typed and compact: `prc_7N3kq0X1...`.
 * The suffix is the row UUID encoded in base62 (22 chars), so no lookup
 * table is needed and internal UUIDs never leak verbatim.
 */
export const ID_PREFIXES = {
  organization: "org",
  farmer: "fmr",
  farm: "farm",
  parcel: "prc",
  crop_cycle: "cyc",
  device: "dev",
  observation: "obs",
  consent: "cns",
  access_log: "alog",
  event: "evt",
  webhook_endpoint: "we",
  notification: "ntf",
  job: "job",
  api_key: "key",
} as const;

export type PublicObject = keyof typeof ID_PREFIXES;

const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ENCODED_LENGTH = 22;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidToBase62(uuid: string): string {
  let n = BigInt("0x" + uuid.replace(/-/g, ""));
  let out = "";
  while (n > 0n) {
    out = ALPHABET[Number(n % 62n)] + out;
    n /= 62n;
  }
  return out.padStart(ENCODED_LENGTH, "0");
}

function base62ToUuid(value: string): string | null {
  if (value.length !== ENCODED_LENGTH) return null;
  let n = 0n;
  for (const ch of value) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) return null;
    n = n * 62n + BigInt(idx);
  }
  const hex = n.toString(16);
  if (hex.length > 32) return null;
  const h = hex.padStart(32, "0");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function encodeId(object: PublicObject, uuid: string): string;
export function encodeId(
  object: PublicObject,
  uuid: string | null | undefined,
): string | null;
export function encodeId(
  object: PublicObject,
  uuid: string | null | undefined,
): string | null {
  if (!uuid) return null;
  if (!UUID_RE.test(uuid)) return null;
  return `${ID_PREFIXES[object]}_${uuidToBase62(uuid)}`;
}

/** Returns the internal UUID, or null when the id is malformed or of another type. */
export function tryDecodeId(object: PublicObject, id: string): string | null {
  if (typeof id !== "string") return null;
  const prefix = `${ID_PREFIXES[object]}_`;
  if (!id.startsWith(prefix)) return null;
  return base62ToUuid(id.slice(prefix.length));
}

/**
 * Decodes or throws a 404: a malformed id can never match a resource, and a
 * 404 avoids telling callers which ids exist.
 */
export function decodeId(object: PublicObject, id: string): string {
  const uuid = tryDecodeId(object, id);
  if (!uuid) {
    throw new ProblemException("resource_missing", { params: { id } });
  }
  return uuid;
}

/** Same as decodeId but for request bodies: a bad reference is a 422. */
export function decodeRef(
  object: PublicObject,
  id: string,
  field: string,
): string {
  const uuid = tryDecodeId(object, id);
  if (!uuid) {
    throw new ProblemException("invalid_reference", {
      params: { field, object },
      errors: [{ field, code: "invalid_reference" }],
    });
  }
  return uuid;
}
