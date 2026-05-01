/**
 * Coefficients culturaux Kc — FAO-56 simplified table.
 * Indexed by culture × stade phénologique. Returns dimensionless multiplier
 * applied to ET0 to obtain ETc (evapotranspiration de la culture).
 *
 * Source: FAO Irrigation and Drainage Paper 56, Table 12.
 * Adapted for Senegal/Sahel conditions (Niayes, Vallée du Fleuve, Casamance).
 */
export const KC_TABLE: Record<string, Record<string, number>> = {
  riz: {
    semis: 1.05,
    levee: 1.1,
    vegetative: 1.15,
    tallage: 1.2,
    floraison: 1.2,
    fruiting: 1.15,
    maturation: 0.9,
    recolte: 0.6,
  },
  mais: {
    semis: 0.4,
    levee: 0.6,
    vegetative: 0.85,
    tallage: 1.05,
    floraison: 1.2,
    fruiting: 1.15,
    maturation: 0.7,
    recolte: 0.4,
  },
  mil: {
    semis: 0.35,
    levee: 0.55,
    vegetative: 0.8,
    tallage: 0.95,
    floraison: 1.0,
    fruiting: 0.95,
    maturation: 0.45,
    recolte: 0.3,
  },
  arachide: {
    semis: 0.4,
    levee: 0.6,
    vegetative: 0.85,
    tallage: 1.05,
    floraison: 1.15,
    fruiting: 1.05,
    maturation: 0.6,
    recolte: 0.4,
  },
  oignon: {
    semis: 0.5,
    levee: 0.7,
    vegetative: 0.95,
    tallage: 1.05,
    floraison: 1.05,
    fruiting: 1.0,
    maturation: 0.85,
    recolte: 0.6,
  },
  tomate: {
    semis: 0.45,
    levee: 0.65,
    vegetative: 0.85,
    tallage: 1.1,
    floraison: 1.15,
    fruiting: 1.15,
    maturation: 0.85,
    recolte: 0.6,
  },
};

export const DEFAULT_KC = 0.8;

export function getKc(culture: string | null, stade: string | null): number {
  if (!culture || !stade) return DEFAULT_KC;
  return KC_TABLE[culture]?.[stade] ?? DEFAULT_KC;
}
