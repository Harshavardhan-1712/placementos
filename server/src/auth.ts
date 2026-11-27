import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { config } from "./config.js";
import { AppError } from "./service.js";

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (p: string) => createHmac("sha256", config.sessionSecret).update(p).digest("base64url");
export const safeEqual = (a: string, b: string) => {
  const x = createHmac("sha256", "cmp").update(a).digest(); const y = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(x, y);
};

export function login(email: string, password: string): string {
  if (!config.adminPassword || !config.sessionSecret) throw new AppError(503, "auth_not_configured", "Server auth is not configured");
  const ok = safeEqual(email.trim().toLowerCase(), config.adminEmail.toLowerCase()) && safeEqual(password, config.adminPassword);
  if (!ok) throw new AppError(401, "invalid_credentials", "Incorrect email or password");
  const payload = b64(JSON.stringify({ sub: config.adminEmail, exp: Date.now() + 7 * 24 * 3600 * 1000 }));
  return `${payload}.${sign(payload)}`;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !config.sessionSecret || !safeEqual(sig, sign(payload))) return next(new AppError(401, "unauthorized", "Sign in required"));
  try { if (JSON.parse(Buffer.from(payload, "base64url").toString()).exp < Date.now()) return next(new AppError(401, "session_expired", "Session expired, sign in again")); }
  catch { return next(new AppError(401, "unauthorized", "Sign in required")); }
  next();
}
