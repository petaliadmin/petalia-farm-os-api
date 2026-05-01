export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: "admin" | "directeur" | "superviseur" | "technicien" | "partenaire";
  organisationId: string | null;
  equipeId: string | null;
}
