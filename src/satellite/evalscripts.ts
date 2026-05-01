import { SatelliteIndexCode } from "./entities/satellite-index.entity";

/**
 * Sentinel-2 L2A evalscripts.
 *
 * Bands used (Sentinel-2 L2A):
 *  B02 blue, B03 green, B04 red, B08 NIR, B8A NIR narrow, B11 SWIR.
 *
 * Cloud / shadow masking via Scene Classification Layer (SCL):
 *  3 = cloud shadow, 8 = cloud medium prob, 9 = cloud high prob, 10 = cirrus.
 *
 * Each script outputs a single band `<code>` plus `dataMask` (0/1) so the
 * Statistics API filters invalid pixels before computing stats.
 */
const VALID_PIXEL =
  "s.dataMask === 1 && s.SCL !== 3 && s.SCL !== 8 && s.SCL !== 9 && s.SCL !== 10";

const HEADER = (id: string, bands: string[]) => `//VERSION=3
function setup() {
  return {
    input: [{ bands: ${JSON.stringify(bands)} }],
    output: [
      { id: "${id}", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}`;

export const EVALSCRIPTS: Record<SatelliteIndexCode, string> = {
  ndvi: `${HEADER("ndvi", ["B04", "B08", "SCL", "dataMask"])}
function evaluatePixel(s) {
  const v = (s.B08 - s.B04) / (s.B08 + s.B04 + 1e-9);
  return { ndvi: [v], dataMask: [${VALID_PIXEL} ? 1 : 0] };
}`,

  // EVI — Enhanced Vegetation Index (resistant to atmosphere & soil)
  evi: `${HEADER("evi", ["B02", "B04", "B08", "SCL", "dataMask"])}
function evaluatePixel(s) {
  const v = 2.5 * ((s.B08 - s.B04) / (s.B08 + 6 * s.B04 - 7.5 * s.B02 + 1));
  return { evi: [v], dataMask: [${VALID_PIXEL} ? 1 : 0] };
}`,

  // SAVI — Soil-Adjusted Vegetation Index (L=0.5, semi-arid soils)
  savi: `${HEADER("savi", ["B04", "B08", "SCL", "dataMask"])}
function evaluatePixel(s) {
  const L = 0.5;
  const v = ((s.B08 - s.B04) / (s.B08 + s.B04 + L)) * (1 + L);
  return { savi: [v], dataMask: [${VALID_PIXEL} ? 1 : 0] };
}`,

  // NDWI — Normalized Difference Water Index (McFeeters / Gao moisture)
  // Using NIR / SWIR variant (Gao 1996) → vegetation water content
  ndwi: `${HEADER("ndwi", ["B08", "B11", "SCL", "dataMask"])}
function evaluatePixel(s) {
  const v = (s.B08 - s.B11) / (s.B08 + s.B11 + 1e-9);
  return { ndwi: [v], dataMask: [${VALID_PIXEL} ? 1 : 0] };
}`,

  // LAI — Leaf Area Index (empirical from EVI; Boegh et al. 2002 simplified)
  // LAI ≈ 3.618 * EVI − 0.118
  lai: `${HEADER("lai", ["B02", "B04", "B08", "SCL", "dataMask"])}
function evaluatePixel(s) {
  const evi = 2.5 * ((s.B08 - s.B04) / (s.B08 + 6 * s.B04 - 7.5 * s.B02 + 1));
  const v = Math.max(0, 3.618 * evi - 0.118);
  return { lai: [v], dataMask: [${VALID_PIXEL} ? 1 : 0] };
}`,
};

export const INDEX_CODES: SatelliteIndexCode[] = [
  "ndvi",
  "evi",
  "savi",
  "ndwi",
  "lai",
];
