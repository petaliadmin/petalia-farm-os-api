import { BenchmarkRendement } from "./entities/benchmark-rendement.entity";

/**
 * Public reference yields for Senegal agroecological zones.
 * Sources: ISRA bulletins agronomiques, FAOSTAT, ANSD recensement agricole.
 * These are seed values — should be reviewed yearly with the agronomic team.
 */
export const ISRA_BENCHMARKS: Partial<BenchmarkRendement>[] = [
  // Riz — Vallée du Fleuve Sénégal (irrigué)
  {
    culture: "riz",
    zoneAgroecologique: "Vallée du Fleuve",
    typeCampagne: "hivernage",
    rendementMoyenTHa: 5.5,
    rendementMinTHa: 4.0,
    rendementMaxTHa: 7.5,
    cycleJours: 120,
    anneeReference: 2024,
  },
  {
    culture: "riz",
    zoneAgroecologique: "Vallée du Fleuve",
    typeCampagne: "contre_saison_chaude",
    rendementMoyenTHa: 6.2,
    rendementMinTHa: 4.5,
    rendementMaxTHa: 8.0,
    cycleJours: 110,
    anneeReference: 2024,
  },
  {
    culture: "riz",
    zoneAgroecologique: "Casamance",
    typeCampagne: "hivernage",
    rendementMoyenTHa: 2.8,
    rendementMinTHa: 1.5,
    rendementMaxTHa: 4.0,
    cycleJours: 130,
    anneeReference: 2024,
  },

  // Mil — Bassin arachidier
  {
    culture: "mil",
    zoneAgroecologique: "Bassin Arachidier",
    typeCampagne: "hivernage",
    rendementMoyenTHa: 0.9,
    rendementMinTHa: 0.5,
    rendementMaxTHa: 1.4,
    cycleJours: 90,
    anneeReference: 2024,
  },
  {
    culture: "mil",
    zoneAgroecologique: "Ferlo",
    typeCampagne: "hivernage",
    rendementMoyenTHa: 0.6,
    rendementMinTHa: 0.3,
    rendementMaxTHa: 1.0,
    cycleJours: 90,
    anneeReference: 2024,
  },

  // Arachide
  {
    culture: "arachide",
    zoneAgroecologique: "Bassin Arachidier",
    typeCampagne: "hivernage",
    rendementMoyenTHa: 1.4,
    rendementMinTHa: 0.8,
    rendementMaxTHa: 2.2,
    cycleJours: 100,
    anneeReference: 2024,
  },
  {
    culture: "arachide",
    zoneAgroecologique: "Casamance",
    typeCampagne: "hivernage",
    rendementMoyenTHa: 1.2,
    rendementMinTHa: 0.7,
    rendementMaxTHa: 1.8,
    cycleJours: 100,
    anneeReference: 2024,
  },

  // Maïs
  {
    culture: "mais",
    zoneAgroecologique: "Casamance",
    typeCampagne: "hivernage",
    rendementMoyenTHa: 3.2,
    rendementMinTHa: 2.0,
    rendementMaxTHa: 5.0,
    cycleJours: 105,
    anneeReference: 2024,
  },
  {
    culture: "mais",
    zoneAgroecologique: "Vallée du Fleuve",
    typeCampagne: "contre_saison_froide",
    rendementMoyenTHa: 4.5,
    rendementMinTHa: 3.0,
    rendementMaxTHa: 6.5,
    cycleJours: 95,
    anneeReference: 2024,
  },

  // Oignon — Niayes / Vallée
  {
    culture: "oignon",
    zoneAgroecologique: "Niayes",
    typeCampagne: "contre_saison_froide",
    rendementMoyenTHa: 22.0,
    rendementMinTHa: 15.0,
    rendementMaxTHa: 35.0,
    cycleJours: 100,
    anneeReference: 2024,
  },
  {
    culture: "oignon",
    zoneAgroecologique: "Vallée du Fleuve",
    typeCampagne: "contre_saison_froide",
    rendementMoyenTHa: 20.0,
    rendementMinTHa: 14.0,
    rendementMaxTHa: 30.0,
    cycleJours: 100,
    anneeReference: 2024,
  },

  // Tomate
  {
    culture: "tomate",
    zoneAgroecologique: "Niayes",
    typeCampagne: "contre_saison_froide",
    rendementMoyenTHa: 25.0,
    rendementMinTHa: 18.0,
    rendementMaxTHa: 40.0,
    cycleJours: 110,
    anneeReference: 2024,
  },
  {
    culture: "tomate",
    zoneAgroecologique: "Vallée du Fleuve",
    typeCampagne: "contre_saison_froide",
    rendementMoyenTHa: 28.0,
    rendementMinTHa: 20.0,
    rendementMaxTHa: 45.0,
    cycleJours: 110,
    anneeReference: 2024,
  },
];
