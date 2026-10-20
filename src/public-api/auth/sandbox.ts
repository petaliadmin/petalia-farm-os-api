import { createHash } from "crypto";

/**
 * Test-mode keys act as a shadow organisation whose id is derived from the
 * real one. Legacy web/mobile queries filter on the real organisation id, so
 * sandbox farmers, parcels and observations never show up in production
 * dashboards, and no extra table or column is needed.
 */
export function sandboxOrganizationId(organisationId: string): string {
  const h = createHash("sha256")
    .update(`petalia-sandbox:${organisationId}`)
    .digest("hex");
  // RFC 4122 layout, version 5 / variant 10, like a name-based UUID.
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
