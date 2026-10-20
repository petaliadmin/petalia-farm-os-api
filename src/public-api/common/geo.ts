import { ProblemException } from "./problem";

export type Position = [number, number];
export interface PointGeometry {
  type: "Point";
  coordinates: Position;
}
export interface PolygonGeometry {
  type: "Polygon";
  coordinates: Position[][];
}

const EARTH_RADIUS_M = 6_378_137;

function invalid(reason: string): never {
  throw new ProblemException("invalid_geometry", { params: { reason } });
}

function isPosition(p: unknown): p is Position {
  return (
    Array.isArray(p) &&
    p.length >= 2 &&
    typeof p[0] === "number" &&
    typeof p[1] === "number" &&
    p[0] >= -180 &&
    p[0] <= 180 &&
    p[1] >= -90 &&
    p[1] <= 90
  );
}

/** RFC 7946 Polygon: closed linear rings of ≥ 4 [lng, lat] positions. */
export function assertPolygon(value: unknown): PolygonGeometry {
  const g = value as PolygonGeometry;
  if (!g || g.type !== "Polygon" || !Array.isArray(g.coordinates)) {
    invalid("geometry must be a GeoJSON Polygon");
  }
  if (g.coordinates.length === 0) invalid("Polygon needs an exterior ring");
  for (const ring of g.coordinates) {
    if (!Array.isArray(ring) || ring.length < 4) {
      invalid("each ring needs at least 4 positions");
    }
    if (!ring.every(isPosition)) {
      invalid("positions are [longitude, latitude] in WGS84 degrees");
    }
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      invalid("rings must be closed (first position = last position)");
    }
  }
  return {
    type: "Polygon",
    coordinates: g.coordinates.map((r) =>
      r.map((p) => [p[0], p[1]] as Position),
    ),
  };
}

export function assertPoint(value: unknown): PointGeometry {
  const g = value as PointGeometry;
  if (!g || g.type !== "Point" || !isPosition(g.coordinates)) {
    invalid("location must be a GeoJSON Point [longitude, latitude]");
  }
  return { type: "Point", coordinates: [g.coordinates[0], g.coordinates[1]] };
}

const rad = (d: number) => (d * Math.PI) / 180;

/** Geodesic ring area on the WGS84 sphere (same method as turf/area). */
function ringAreaM2(ring: Position[]): number {
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[i + 1];
    total += rad(lng2 - lng1) * (2 + Math.sin(rad(lat1)) + Math.sin(rad(lat2)));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

export function polygonAreaHa(polygon: PolygonGeometry): number {
  const [outer, ...holes] = polygon.coordinates;
  const m2 = holes.reduce((a, h) => a - ringAreaM2(h), ringAreaM2(outer));
  return Math.round((m2 / 10_000) * 10_000) / 10_000;
}

export interface Bbox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/** "minLng,minLat,maxLng,maxLat" */
export function parseBbox(raw: string): Bbox {
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    invalid("bbox = minLng,minLat,maxLng,maxLat");
  }
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (minLng > maxLng || minLat > maxLat) {
    invalid("bbox min values must be lower than max values");
  }
  return { minLng, minLat, maxLng, maxLat };
}

/** near = "lat,lng"; radius in metres (default 1 000, max 100 000). */
export function parseNear(
  near: string,
  radius?: string | number,
): { lat: number; lng: number; radiusM: number } {
  const [lat, lng] = near.split(",").map(Number);
  if (!isPosition([lng, lat])) invalid("near = latitude,longitude");
  const radiusM = radius === undefined ? 1000 : Number(radius);
  if (!Number.isFinite(radiusM) || radiusM <= 0 || radiusM > 100_000) {
    invalid("radius is in metres, between 1 and 100000");
  }
  return { lat, lng, radiusM };
}

/** intersects = a GeoJSON geometry (JSON string). */
export function parseIntersects(raw: string): Record<string, unknown> {
  try {
    const g = JSON.parse(raw);
    if (g?.type === "Polygon") return assertPolygon(g) as never;
    if (g?.type === "Point") return assertPoint(g) as never;
  } catch (err) {
    if (err instanceof ProblemException) throw err;
  }
  return invalid("intersects must be a GeoJSON Point or Polygon");
}
