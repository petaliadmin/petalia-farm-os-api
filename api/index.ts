import express, { Express } from "express";
import { VercelRequest, VercelResponse } from "@vercel/node";

// A stray background rejection (Redis client, fire-and-forget promise) would
// otherwise terminate the whole function instance: log it with its stack.
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

// Runs the output of `nest build` (the "vercel-build" script) — the same
// compiled code as the Docker image on AWS — instead of letting Vercel
// transpile src/ file by file, which breaks decorator metadata.
// Typed locally: importing src/ types here would make Vercel type-check the
// whole app outside of its tsconfig.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createApp } = require("../dist/main") as {
  createApp(server: Express): Promise<{ init(): Promise<unknown> }>;
};

let cachedServer: Promise<Express> | null = null;

async function getServer(): Promise<Express> {
  const server = express();
  const app = await createApp(server);
  await app.init();
  return server;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  // Cache the promise so concurrent cold-start requests share one boot;
  // a failed boot is retried by the next request.
  cachedServer ??= getServer().catch((err) => {
    cachedServer = null;
    throw err;
  });
  const server = await cachedServer;
  server(req as any, res as any);
}
