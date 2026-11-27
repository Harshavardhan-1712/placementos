// Single source of truth for business rules + DB operations.
// Used by BOTH the REST API (dashboard / public page) and the MCP tools.
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { pool } from "./db.js";
import { config } from "./config.js";

export type Actor = "claude" | "dashboard" | "student";
export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}

// ---------- validation ----------
const parseDeadline = (v: string) => {
  const s = v.trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T23:59:59+05:30` : s; // date-only => end of day IST
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error("invalid date");
  return d;
};
const deadline = z.string().trim().refine((v) => { try { parseDeadline(v); return true; } catch { return false; } },
  "must be an ISO date (YYYY-MM-DD) or ISO date-time").transform(parseDeadline);
const strList = (max: number, itemMax: number) =>
  z.array(z.string().trim().min(1).max(itemMax)).max(max);

// Base fields have NO defaults: defaults on a .partial() schema would silently reset omitted fields on update.
const driveBase = {
  company: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000),
  eligibleDepartments: strList(30, 80).min(1, "at least one department (use \"All\" for every department)"),
  graduationYear: z.number().int().min(2000).max(2100),
  minCgpa: z.number().min(0).max(10),
  maxBacklogs: z.number().int().min(0).max(50),
  ctc: z.string().trim().max(80),
  location: z.string().trim().max(160),
  registrationDeadline: deadline,
  rounds: strList(12, 120),
};
export const DriveCreate = z.object({
  ...driveBase,
  description: driveBase.description.default(""), minCgpa: driveBase.minCgpa.default(0), maxBacklogs: driveBase.maxBacklogs.default(0),
  ctc: driveBase.ctc.default(""), location: driveBase.location.default(""), rounds: driveBase.rounds.default([]),
}).strict();
export const DriveUpdate = z.object(driveBase).partial().strict()
  .refine((o) => Object.keys(o).length > 0, "provide at least one field to update");
export type DriveCreateInput = z.infer<typeof DriveCreate>;

export const STATUSES = ["registered", "shortlisted", "rejected", "selected"] as const;
export type ApplicantStatus = (typeof STATUSES)[number];

export const RegisterInput = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().transform((v) => v.replace(/[\s-]/g, "")).pipe(z.string().regex(/^(\+91|0)?[6-9]\d{9}$/, "enter a valid 10-digit Indian mobile number")),
  rollNumber: z.string().trim().min(2).max(40),
  department: z.string().trim().min(1).max(80),
  cgpa: z.number().min(0).max(10),
  graduationYear: z.number().int().min(2000).max(2100),
  backlogs: z.number().int().min(0).max(50).default(0),
}).strict();

export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw new AppError(400, "validation_error", "Invalid input",
      r.error.issues.map((i) => ({ field: i.path.join(".") || "(root)", message: i.message })));
  }
  return r.data;
}

// ---------- mappers ----------
const driveCols = `d.id, d.slug, d.company, d.title, d.description, d.eligible_departments, d.graduation_year, d.min_cgpa,
  d.max_backlogs, d.ctc, d.location, d.registration_deadline, d.rounds, d.status, d.published_at, d.created_by, d.created_at, d.updated_at,
  (SELECT count(*) FROM applicants a WHERE a.drive_id = d.id) AS applicant_count`;
const publicUrl = (slug: string) => `${config.publicBaseUrl}/d/${slug}`;
const mapDrive = (r: any) => ({
  id: r.id, slug: r.slug, company: r.company, title: r.title, description: r.description,
  eligibleDepartments: r.eligible_departments, graduationYear: r.graduation_year, minCgpa: r.min_cgpa,
  maxBacklogs: r.max_backlogs, ctc: r.ctc, location: r.location,
  registrationDeadline: new Date(r.registration_deadline).toISOString(), rounds: r.rounds, status: r.status as "draft" | "published" | "archived",
  publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null, createdBy: r.created_by,
  createdAt: new Date(r.created_at).toISOString(), updatedAt: new Date(r.updated_at).toISOString(),
  applicantCount: r.applicant_count ?? 0,
  publicUrl: r.status === "published" ? publicUrl(r.slug) : null,
});
const mapApplicant = (r: any) => ({
  id: r.id, driveId: r.drive_id, name: r.name, email: r.email, phone: r.phone, rollNumber: r.roll_number,
  department: r.department, cgpa: r.cgpa, backlogs: r.backlogs, graduationYear: r.graduation_year,
  status: r.status as ApplicantStatus, registeredAt: new Date(r.created_at).toISOString(), updatedAt: new Date(r.updated_at).toISOString(),
});
export type Drive = ReturnType<typeof mapDrive>;
export type Applicant = ReturnType<typeof mapApplicant>;

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

async function log(actor: Actor, kind: string, message: string, driveId: string | null) {
  await pool.query("INSERT INTO activity (drive_id, actor, kind, message) VALUES ($1,$2,$3,$4)", [driveId, actor, kind, message]);
}

// ---------- drives ----------
export async function createDrive(input: unknown, actor: Actor): Promise<Drive> {
  const d = parseOrThrow(DriveCreate, input);
  const slug = `${slugify(`${d.company}-${d.title}`)}-${randomBytes(3).toString("hex")}`;
  const { rows } = await pool.query(
    `INSERT INTO drives (slug, company, title, description, eligible_departments, graduation_year, min_cgpa, max_backlogs, ctc, location, registration_deadline, rounds, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13) RETURNING id`,
    [slug, d.company, d.title, d.description, d.eligibleDepartments, d.graduationYear, d.minCgpa, d.maxBacklogs, d.ctc, d.location, d.registrationDeadline, JSON.stringify(d.rounds), actor]);
  await log(actor, "drive_created", `${d.company} – ${d.title} drive created`, rows[0].id);
  return getDrive(rows[0].id);
}

export async function listDrives(opts: { status?: string; search?: string } = {}): Promise<Drive[]> {
  const where: string[] = []; const params: unknown[] = [];
  if (opts.status) {
    if (!["draft", "published", "archived"].includes(opts.status)) throw new AppError(400, "validation_error", "status must be draft, published or archived");
    params.push(opts.status); where.push(`d.status = $${params.length}`);
  }
  if (opts.search?.trim()) { params.push(`%${opts.search.trim()}%`); where.push(`(d.company ILIKE $${params.length} OR d.title ILIKE $${params.length})`); }
  const { rows } = await pool.query(`SELECT ${driveCols} FROM drives d ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY d.created_at DESC LIMIT 500`, params);
  return rows.map(mapDrive);
}

export async function getDrive(idOrSlug: string): Promise<Drive> {
  const col = isUuid(idOrSlug) ? "d.id" : "d.slug";
  const { rows } = await pool.query(`SELECT ${driveCols} FROM drives d WHERE ${col} = $1`, [idOrSlug]);
  if (!rows[0]) throw new AppError(404, "not_found", "Recruitment drive not found");
  return mapDrive(rows[0]);
}

export async function updateDrive(id: string, input: unknown, actor: Actor): Promise<Drive> {
  const cur = await getDrive(id);
  if (cur.status === "archived") throw new AppError(409, "archived", "Archived drives are read-only. Restore the drive to draft before editing.");
  const u = parseOrThrow(DriveUpdate, input);
  const map: Record<string, string> = { company: "company", title: "title", description: "description", eligibleDepartments: "eligible_departments",
    graduationYear: "graduation_year", minCgpa: "min_cgpa", maxBacklogs: "max_backlogs", ctc: "ctc", location: "location", registrationDeadline: "registration_deadline", rounds: "rounds" };
  const sets: string[] = []; const params: unknown[] = [];
  for (const [k, v] of Object.entries(u)) {
    params.push(k === "rounds" ? JSON.stringify(v) : v);
    sets.push(`${map[k]} = $${params.length}${k === "rounds" ? "::jsonb" : ""}`);
  }
  params.push(cur.id);
  await pool.query(`UPDATE drives SET ${sets.join(", ")}, updated_at = now() WHERE id = $${params.length}`, params);
  await log(actor, "drive_updated", `${cur.company} – ${cur.title} updated (${Object.keys(u).join(", ")})`, cur.id);
  return getDrive(cur.id);
}

async function setStatus(id: string, to: "draft" | "published" | "archived", actor: Actor, kind: string, verb: string): Promise<Drive> {
  const cur = await getDrive(id);
  if (cur.status === to) return cur; // idempotent
  if (to === "published") {
    if (cur.status === "archived") throw new AppError(409, "archived", "Archived drives cannot be published. Restore to draft first.");
    if (new Date(cur.registrationDeadline) <= new Date()) throw new AppError(422, "deadline_passed", "Registration deadline is in the past. Update the deadline before publishing.");
  }
  await pool.query(`UPDATE drives SET status = $1, published_at = CASE WHEN $1 = 'published' THEN now() ELSE published_at END, updated_at = now() WHERE id = $2`, [to, cur.id]);
  await log(actor, kind, `${cur.company} – ${cur.title} ${verb}`, cur.id);
  return getDrive(cur.id);
}
export const publishDrive = (id: string, a: Actor) => setStatus(id, "published", a, "drive_published", "published");
export const unpublishDrive = async (id: string, a: Actor) => {
  const cur = await getDrive(id);
  if (cur.status === "archived") throw new AppError(409, "archived", "Drive is archived, not published.");
  return setStatus(id, "draft", a, "drive_unpublished", "unpublished");
};
export const archiveDrive = (id: string, a: Actor) => setStatus(id, "archived", a, "drive_archived", "archived");
export const restoreDrive = async (id: string, a: Actor) => {
  const cur = await getDrive(id);
  if (cur.status !== "archived") throw new AppError(409, "not_archived", "Drive is not archived.");
  return setStatus(id, "draft", a, "drive_restored", "restored to draft");
};

// ---------- eligibility + registration ----------
export function checkEligibility(d: Drive, s: { department: string; cgpa: number; graduationYear: number; backlogs: number }): string[] {
  const reasons: string[] = [];
  const depts = d.eligibleDepartments.map((x: string) => x.trim().toLowerCase());
  if (!depts.includes("all") && !depts.includes(s.department.trim().toLowerCase()))
    reasons.push(`Department "${s.department}" is not eligible (eligible: ${d.eligibleDepartments.join(", ")})`);
  if (s.graduationYear !== d.graduationYear) reasons.push(`Only the ${d.graduationYear} graduating batch is eligible`);
  if (s.cgpa < d.minCgpa) reasons.push(`Minimum CGPA required is ${d.minCgpa}`);
  if (s.backlogs > d.maxBacklogs) reasons.push(d.maxBacklogs === 0 ? "Students with active backlogs are not eligible" : `At most ${d.maxBacklogs} active backlog(s) allowed`);
  return reasons;
}

export async function getPublicDrive(slug: string) {
  const d = await getDrive(slug);
  if (d.status !== "published") throw new AppError(404, "not_found", "This recruitment drive is not open for registration");
  const { applicantCount, createdBy, id, publicUrl: _p, ...pub } = d; // no internal fields
  return { ...pub, registrationOpen: new Date(d.registrationDeadline) > new Date() };
}

export async function registerStudent(slug: string, input: unknown) {
  const d = await getDrive(slug);
  if (d.status !== "published") throw new AppError(404, "not_found", "This recruitment drive is not open for registration");
  if (new Date(d.registrationDeadline) <= new Date()) throw new AppError(422, "registration_closed", "Registration for this drive has closed");
  const s = parseOrThrow(RegisterInput, input);
  const reasons = checkEligibility(d, s);
  if (reasons.length) throw new AppError(422, "not_eligible", "You do not meet the eligibility criteria for this drive", reasons);
  try {
    const { rows } = await pool.query(
      `INSERT INTO applicants (drive_id, name, email, phone, roll_number, department, cgpa, backlogs, graduation_year)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [d.id, s.name, s.email, s.phone, s.rollNumber, s.department, s.cgpa, s.backlogs, s.graduationYear]);
    await log("student", "applicant_registered", `${s.name} (${s.rollNumber}) registered for ${d.company}`, d.id);
    return mapApplicant(rows[0]);
  } catch (e: any) {
    if (e.code === "23505") throw new AppError(409, "duplicate_registration", "You have already registered for this drive (email or roll number already used)");
    throw e;
  }
}

// ---------- applicants ----------
export async function listApplicants(driveId: string, opts: { status?: string; search?: string; limit?: number } = {}) {
  const d = await getDrive(driveId);
  if (opts.status && !STATUSES.includes(opts.status as any)) throw new AppError(400, "validation_error", `status must be one of ${STATUSES.join(", ")}`);
  const params: unknown[] = [d.id]; const where = ["drive_id = $1"];
  if (opts.status) { params.push(opts.status); where.push(`status = $${params.length}`); }
  if (opts.search?.trim()) { params.push(`%${opts.search.trim()}%`); where.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length} OR roll_number ILIKE $${params.length})`); }
  const limit = Math.min(Math.max(opts.limit ?? 500, 1), 1000);
  const { rows } = await pool.query(`SELECT * FROM applicants WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ${limit}`, params);
  const counts = await pool.query("SELECT status, count(*) AS n FROM applicants WHERE drive_id = $1 GROUP BY status", [d.id]);
  const byStatus: Record<string, number> = { registered: 0, shortlisted: 0, rejected: 0, selected: 0 };
  for (const c of counts.rows) byStatus[c.status] = c.n;
  return { drive: { id: d.id, company: d.company, title: d.title, status: d.status }, applicants: rows.map(mapApplicant), counts: byStatus };
}

export async function updateApplicantStatus(applicantId: string, status: unknown, actor: Actor): Promise<Applicant> {
  if (!isUuid(applicantId)) throw new AppError(400, "validation_error", "applicantId must be a valid UUID");
  const st = parseOrThrow(z.enum(STATUSES), status);
  const { rows } = await pool.query(
    `UPDATE applicants a SET status = $1, updated_at = now() FROM drives d WHERE a.id = $2 AND d.id = a.drive_id
     RETURNING a.*, d.company AS _company`, [st, applicantId]);
  if (!rows[0]) throw new AppError(404, "not_found", "Applicant not found");
  await log(actor, "applicant_status", `${rows[0].name} marked ${st} for ${rows[0]._company}`, rows[0].drive_id);
  return mapApplicant(rows[0]);
}

// ---------- dashboard ----------
export async function dashboard() {
  const [c, a, up, act, st] = await Promise.all([
    pool.query(`SELECT count(*) FILTER (WHERE status <> 'archived') AS total, count(*) FILTER (WHERE status='published') AS published,
                count(*) FILTER (WHERE status='draft') AS draft, count(*) FILTER (WHERE status='archived') AS archived,
                count(*) FILTER (WHERE status='published' AND registration_deadline > now()) AS active FROM drives`),
    pool.query("SELECT count(*) AS n FROM applicants"),
    pool.query(`SELECT ${driveCols} FROM drives d WHERE d.status='published' AND d.registration_deadline > now() ORDER BY d.registration_deadline ASC LIMIT 5`),
    pool.query(`SELECT a.id, a.actor, a.kind, a.message, a.created_at, a.drive_id FROM activity a ORDER BY a.created_at DESC, a.id DESC LIMIT 10`),
    pool.query("SELECT status, count(*) AS n FROM applicants GROUP BY status"),
  ]);
  const byStatus: Record<string, number> = { registered: 0, shortlisted: 0, rejected: 0, selected: 0 };
  for (const r of st.rows) byStatus[r.status] = r.n;
  return {
    totals: { drives: c.rows[0].total, published: c.rows[0].published, draft: c.rows[0].draft, archived: c.rows[0].archived, activeOpen: c.rows[0].active, applicants: a.rows[0].n },
    applicantsByStatus: byStatus,
    upcomingDeadlines: up.rows.map(mapDrive),
    recentActivity: act.rows.map((r) => ({ id: r.id, actor: r.actor as Actor, kind: r.kind, message: r.message, driveId: r.drive_id, at: new Date(r.created_at).toISOString() })),
  };
}
