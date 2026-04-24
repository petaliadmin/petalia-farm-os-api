import express, { Express } from "express";
import { VercelRequest, VercelResponse } from "@vercel/node";
import { createApp } from "../src/main";

let cachedServer: Express | null = null;

async function getServer(): Promise<Express> {
  if (cachedServer) return cachedServer;
  const server = express();
  const app = await createApp(server);
  await app.init();
  cachedServer = server;
  return cachedServer;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const server = await getServer();
  server(req as any, res as any);
}
