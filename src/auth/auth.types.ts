declare module "express-serve-static-core" {
  interface Request {
    user?: {
      sub: string;
      email: string | null;
      role: string;
      organisationId?: string | null;
      equipeId?: string | null;
    };
  }
}
