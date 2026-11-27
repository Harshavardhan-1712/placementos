import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { config, assertProdConfig } from "./config.js";
import { pool } from "./db.js";
import { migrate } from "./migrate.js";
import { api } from "./routes.js";
import { handleMcp } from "./mcp.js";
import { AppError } from "./service.js";
import { safeEqual } from "./auth.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false }));
  if (config.corsOrigins.length) app.use("/api", cors({ origin: config.corsOrigins }));

  app.get("/healthz", async (_req, res) => {
    try { await pool.query("SELECT 1"); res.json({ status: "ok", db: "up" }); }
    catch { res.status(503).json({ status: "degraded", db: "down" }); }
  });

  // Remote MCP endpoint. The secret path segment is the connector credential (Claude custom connectors accept a URL).
  app.all("/mcp/:secret", express.json({ limit: "200kb" }), (req, res, next) => {
    if (!config.mcpSecret || !safeEqual(String(req.params.secret), config.mcpSecret)) return res.status(404).json({ error: "not_found" });
    if (req.method !== "POST") return res.status(405).set("Allow", "POST").json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed (stateless server: use POST)" }, id: null });
    handleMcp(req, res).catch(next);
  });

  app.use("/api", express.json({ limit: "100kb" }), api);

  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist");
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: "1h" }));
    app.get(/^\/(?!api|mcp|healthz).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    if (err?.type === "entity.parse.failed") return res.status(400).json({ error: { code: "bad_json", message: "Malformed JSON body" } });
    if (err?.type === "entity.too.large") return res.status(413).json({ error: { code: "too_large", message: "Request body too large" } });
    console.error("[error]", err);
    res.status(500).json({ error: { code: "internal_error", message: "Something went wrong on our side" } });
  });
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { if (config.isProd) assertProdConfig(); } catch (e: any) { console.error("startup failed:", e.message); process.exit(1); }
  migrate().then(() => {
    createApp().listen(config.port, () => console.log(`PlacementOS listening on :${config.port}`));
  }).catch((e) => { console.error("startup failed:", e.message); process.exit(1); });
}
