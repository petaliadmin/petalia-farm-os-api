import { ValidateBy, ValidationOptions } from "class-validator";

export const LANGUAGES = ["fr", "wo", "ff", "en", "srr", "dyo", "mnk"] as const;

/** Stripe-style metadata: ≤ 50 string pairs, keys ≤ 40 chars, values ≤ 500. */
export function IsMetadata(options?: ValidationOptions) {
  return ValidateBy(
    {
      name: "isMetadata",
      validator: {
        validate: (value: unknown) => {
          if (!value || typeof value !== "object" || Array.isArray(value)) {
            return false;
          }
          const entries = Object.entries(value);
          return (
            entries.length <= 50 &&
            entries.every(
              ([k, v]) =>
                k.length > 0 &&
                k.length <= 40 &&
                typeof v === "string" &&
                v.length <= 500,
            )
          );
        },
        defaultMessage: () =>
          "metadata must be an object of at most 50 string values (key ≤ 40, value ≤ 500 chars)",
      },
    },
    options,
  );
}

export const GEOJSON_POINT_SCHEMA = {
  type: "object",
  example: { type: "Point", coordinates: [-16.93, 14.94] },
} as const;

export const GEOJSON_POLYGON_SCHEMA = {
  type: "object",
  description: "GeoJSON Polygon (RFC 7946), [longitude, latitude] WGS84.",
  example: {
    type: "Polygon",
    coordinates: [
      [
        [-16.931, 14.941],
        [-16.929, 14.941],
        [-16.929, 14.943],
        [-16.931, 14.943],
        [-16.931, 14.941],
      ],
    ],
  },
} as const;
