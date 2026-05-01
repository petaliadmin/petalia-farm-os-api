export interface CreditNotificationDto {
  creditId?: string;
  nationalId: string;
  montant: number;
  devise: string;
  dateApprobation: string;
  dateDebut: string;
  dateFin: string;
  tauxInteret: number;
  montantMensualite: number;
  status: string;
  motif?: string;
  cycleProduction: string;
  objectif: string;
}

export interface DeclareSinistreDto {
  nationalId: string;
  dateSurvenance: string;
  typeSinistre: string;
  culture?: string;
  superficieImpactee: number;
  superficieTotale: number;
  perteEstimee: number;
  description: string;
  documents?: string[];
  photoEvidenceUrl?: string;
}

export interface IndemnisationWebhookDto {
  sinistreId: string;
  nationalId: string;
  montantIndemnise: number;
  devise: string;
  status: string;
  dateTraitement: string;
  referencePaiement?: string;
  notes?: string;
}

export interface DeclarationCampagneDto {
  nationalId: string;
  campagne: string;
  dateDebut: string;
  dateFin: string;
  cultures: CultureDeclarationDto[];
  superficieTotale: number;
  objectifs?: string;
}

export interface CultureDeclarationDto {
  culture: string;
  superficie: number;
  variete?: string;
  objectifProduction?: number;
  uniteProduction?: string;
}
