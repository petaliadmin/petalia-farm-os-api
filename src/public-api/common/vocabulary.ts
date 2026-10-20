/**
 * Controlled vocabularies of the public API.
 *
 * Crop codes are stable English identifiers. Labels: fr/en only for now —
 * Wolof and Pulaar labels need a native speaker before being added.
 * Mapping them to AGROVOC concept
 * URIs (FAO) is planned: add an `agrovoc` field here once each URI has been
 * checked against the AGROVOC SPARQL endpoint, never from memory.
 */
export const CROPS = {
  rice: { fr: "Riz", en: "Rice", legacy: "riz" },
  maize: { fr: "Maïs", en: "Maize", legacy: "mais" },
  millet: { fr: "Mil", en: "Millet", legacy: "mil" },
  groundnut: { fr: "Arachide", en: "Groundnut", legacy: "arachide" },
  onion: { fr: "Oignon", en: "Onion", legacy: "oignon" },
  tomato: { fr: "Tomate", en: "Tomato", legacy: "tomate" },
  sorghum: { fr: "Sorgho", en: "Sorghum", legacy: "autre" },
  cowpea: { fr: "Niébé", en: "Cowpea", legacy: "autre" },
  cassava: { fr: "Manioc", en: "Cassava", legacy: "autre" },
  other: { fr: "Autre", en: "Other", legacy: "autre" },
} as const;
export type CropCode = keyof typeof CROPS;
export const CROP_CODES = Object.keys(CROPS) as CropCode[];

const LEGACY_TO_CROP: Record<string, CropCode> = {
  riz: "rice",
  mais: "maize",
  mil: "millet",
  arachide: "groundnut",
  oignon: "onion",
  tomate: "tomato",
  autre: "other",
};

export function cropFromLegacy(
  value: string | null | undefined,
): CropCode | null {
  return value ? (LEGACY_TO_CROP[value] ?? "other") : null;
}

export function cropToLegacy(code: CropCode): string {
  return CROPS[code].legacy;
}

/** Senegalese campaigns ↔ public season codes. */
export const SEASONS = {
  rainy: "hivernage",
  cold_dry: "contre_saison_froide",
  hot_dry: "contre_saison_chaude",
} as const;

export const GROWTH_STAGES: Record<string, string> = {
  semis: "sowing",
  levee: "emergence",
  vegetative: "vegetative",
  tallage: "tillering",
  floraison: "flowering",
  fruiting: "fruiting",
  maturation: "maturity",
  recolte: "harvest",
};

export const LAND_TENURE: Record<string, string> = {
  propriete: "owned",
  pret: "borrowed",
  location: "rented",
  communautaire: "communal",
};

/**
 * Observable properties with their canonical unit. Values are always stored
 * and returned in the canonical unit; SenML units are mapped on ingestion.
 */
export const OBSERVED_PROPERTIES = {
  soil_moisture: {
    unit: "%",
    senml: ["%", "%RH", "/"],
    description: "Humidité volumique du sol",
  },
  soil_temperature: {
    unit: "°C",
    senml: ["Cel"],
    description: "Température du sol",
  },
  soil_ec: {
    unit: "dS/m",
    senml: ["S/m"],
    description: "Conductivité électrique du sol",
  },
  soil_ph: { unit: "pH", senml: ["pH"], description: "pH du sol" },
  air_temperature: {
    unit: "°C",
    senml: ["Cel"],
    description: "Température de l'air",
  },
  relative_humidity: {
    unit: "%",
    senml: ["%RH", "%"],
    description: "Humidité relative de l'air",
  },
  rainfall: { unit: "mm", senml: ["mm", "m"], description: "Cumul de pluie" },
  wind_speed: { unit: "m/s", senml: ["m/s"], description: "Vitesse du vent" },
  solar_radiation: {
    unit: "W/m2",
    senml: ["W/m2"],
    description: "Rayonnement solaire",
  },
  leaf_wetness: {
    unit: "%",
    senml: ["%", "/"],
    description: "Humectation foliaire",
  },
  water_level: {
    unit: "cm",
    senml: ["m", "cm"],
    description: "Niveau d'eau (rizière, canal)",
  },
  battery_voltage: {
    unit: "V",
    senml: ["V"],
    description: "Tension batterie du capteur",
  },
  ndvi: {
    unit: "1",
    senml: ["/", "1"],
    description: "Indice de végétation (sans dimension)",
  },
  pest_trap_count: {
    unit: "count",
    senml: ["count", "1"],
    description: "Individus capturés par piège",
  },
} as const;
export type ObservedProperty = keyof typeof OBSERVED_PROPERTIES;

/**
 * Converts a SenML value to the canonical unit of the property.
 * Returns null when the unit is not convertible.
 */
export function fromSenml(
  property: ObservedProperty,
  senmlUnit: string | undefined,
  value: number,
): number | null {
  const def = OBSERVED_PROPERTIES[property];
  const unit = senmlUnit ?? def.unit;
  if (unit === def.unit) return value;
  if (!(def.senml as readonly string[]).includes(unit)) return null;
  // Ratios ("/") become percentages for % properties.
  if (def.unit === "%" && unit === "/") return value * 100;
  if (property === "rainfall" && unit === "m") return value * 1000;
  if (property === "water_level" && unit === "m") return value * 100;
  if (property === "soil_ec" && unit === "S/m") return value * 10;
  return value;
}
