import { Router, type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import * as svc from "./service.js";
import { login, requireAuth } from "./auth.js";

const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).then((d) => { if (d !== undefined && !res.headersSent) res.json(d); }).catch(next);
const q = (v: unknown) => (typeof v === "string" ? v : undefined);
const A: svc.Actor = "dashboard";
const P = (req: Request, k: string) => String(req.params[k]);

export const api = Router();

api.post("/auth/login", rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }),
  wrap(async (req) => ({ token: login(String(req.body?.email ?? ""), String(req.body?.password ?? "")) })));

// public (no auth)
const publicLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
api.get("/public/drives/:slug", wrap((req) => svc.getPublicDrive(P(req, "slug"))));
api.post("/public/drives/:slug/register", publicLimiter, wrap(async (req, res) => {
  const a = await svc.registerStudent(P(req, "slug"), req.body);
  res.status(201).json({ ok: true, message: "Registration successful", applicantId: a.id });
}));

// authenticated dashboard
api.use(requireAuth);
api.get("/dashboard", wrap(() => svc.dashboard()));
api.get("/drives", wrap(async (req) => ({ drives: await svc.listDrives({ status: q(req.query.status), search: q(req.query.search) }) })));
api.post("/drives", wrap(async (req, res) => { res.status(201).json(await svc.createDrive(req.body, A)); }));
api.get("/drives/:id", wrap((req) => svc.getDrive(P(req, "id"))));
api.patch("/drives/:id", wrap((req) => svc.updateDrive(P(req, "id"), req.body, A)));
api.post("/drives/:id/publish", wrap((req) => svc.publishDrive(P(req, "id"), A)));
api.post("/drives/:id/unpublish", wrap((req) => svc.unpublishDrive(P(req, "id"), A)));
api.post("/drives/:id/archive", wrap((req) => svc.archiveDrive(P(req, "id"), A)));
api.post("/drives/:id/restore", wrap((req) => svc.restoreDrive(P(req, "id"), A)));
api.get("/drives/:id/applicants", wrap((req) => svc.listApplicants(P(req, "id"), { status: q(req.query.status), search: q(req.query.search) })));
api.patch("/applicants/:id/status", wrap((req) => svc.updateApplicantStatus(P(req, "id"), req.body?.status, A)));
api.use((_req, _res, next) => next(new svc.AppError(404, "not_found", "Unknown API route")));
