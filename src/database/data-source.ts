import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
import { buildDataSourceOptions } from "./database.config";

dotenv.config({ path: ".env.production" });
dotenv.config({ path: ".env.development" });
dotenv.config({ path: ".env" });

export const AppDataSource = new DataSource(
  buildDataSourceOptions((key) => process.env[key], { forMigrations: true }),
);
