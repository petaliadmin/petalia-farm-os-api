export interface ParcelleStats {
  total: number;
  urgentes: number;
  enAttention: number;
  totalHa: number;
}

export interface ParcelleResponse {
  id: string;
  code: string;
  nom: string;
  superficie: number;
  culture: string;
  stade: string;
  statut: "sain" | "attention" | "urgent" | "recolte";
  techniciensId: string;
  producteurNom: string;
  coordonnees?: { lat: number; lng: number };
  geometry?: { lat: number; lng: number }[];
  zone: string;
  typesSol: string;
  derniereVisite: string;
  prochaineVisite: string;
  rendementPrecedent: number;
  createdAt: string;
  exploitantNom?: string;
  localite?: string;
  zoneAgroecologique?: string;
  typeSol?: string;
  modeAccesTerre?: string;
  sourceEau?: string;
  variete?: string;
  typeCampagne?: string;
  dateSemis?: string;
  densite?: string;
  culturePrecedente?: string;
  rotationPrevue?: string;
}
