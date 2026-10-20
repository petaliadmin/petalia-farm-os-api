import { ProblemException } from "./problem";

const DEFAULT_COUNTRY_CODE = "+221";

/**
 * Normalises a phone number to E.164. Local Senegalese numbers
 * ("77 123 45 67", "0771234567") get +221; "00…" becomes "+…".
 */
export function normalizePhone(raw: string, field = "phone"): string {
  const compact = (raw ?? "").replace(/[\s().-]/g, "");
  let e164: string;
  if (compact.startsWith("+")) e164 = compact;
  else if (compact.startsWith("00")) e164 = `+${compact.slice(2)}`;
  else e164 = `${DEFAULT_COUNTRY_CODE}${compact.replace(/^0/, "")}`;

  if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
    throw new ProblemException("validation_failed", {
      errors: [
        {
          field,
          code: "invalid_phone",
          message: "E.164 expected, e.g. +221771234567",
        },
      ],
    });
  }
  return e164;
}

/** "+221771234567" → "+221 77 *** ** 67" for messages shown to third parties. */
export function maskPhone(e164: string): string {
  return e164.length > 6
    ? `${e164.slice(0, 6)}${"*".repeat(e164.length - 8)}${e164.slice(-2)}`
    : e164;
}
