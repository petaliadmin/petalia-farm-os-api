/**
 * Where the process runs.
 *
 *   - "server" (default): long-lived process (AWS EC2 / Docker). Bull workers
 *     poll Redis and @Cron jobs fire in-process.
 *   - "serverless": Vercel functions. Instances are frozen between requests,
 *     so nothing may run in the background: queues are drained and cron jobs
 *     are triggered over HTTP by Vercel Cron (see src/serverless).
 *
 * Vercel sets VERCEL=1 on every deployment; RUNTIME_MODE forces either mode
 * (e.g. RUNTIME_MODE=serverless locally to reproduce Vercel behaviour).
 */
export function isServerless(): boolean {
  const mode = process.env.RUNTIME_MODE;
  if (mode) return mode === "serverless";
  return process.env.VERCEL === "1";
}
