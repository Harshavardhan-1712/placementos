import type { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import * as svc from "./service.js";

const A: svc.Actor = "claude";
const ok = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data as Record<string, unknown> });
const fail = (e: unknown) => {
  if (e instanceof svc.AppError) return { isError: true, content: [{ type: "text" as const, text: JSON.stringify({ error: e.code, message: e.message, details: e.details ?? null }, null, 2) }] };
  console.error("[mcp] unexpected error", e);
  return { isError: true, content: [{ type: "text" as const, text: JSON.stringify({ error: "internal_error", message: "Unexpected server error; nothing was saved unless stated otherwise." }) }] };
};
const run = (fn: (a: any) => Promise<unknown>) => async (args: any) => { try { return ok(await fn(args)); } catch (e) { return fail(e); } };

const driveShape = {
  company: z.string().describe("Company name, e.g. 'Acme Technologies'"),
  title: z.string().describe("Job title, e.g. 'Software Engineer'"),
  description: z.string().optional().describe("Job description / role summary"),
  eligibleDepartments: z.array(z.string()).describe("Eligible departments, e.g. ['CSE','IT','ECE']. Use ['All'] to allow every department."),
  graduationYear: z.number().int().describe("Eligible graduating batch year, e.g. 2027"),
  minCgpa: z.number().optional().describe("Minimum CGPA on a 10-point scale (default 0)"),
  maxBacklogs: z.number().int().optional().describe("Maximum active backlogs allowed; 0 means no backlogs (default 0)"),
  ctc: z.string().optional().describe("Package / CTC as text, e.g. '12 LPA'"),
  location: z.string().optional().describe("Job location, e.g. 'Bengaluru'"),
  registrationDeadline: z.string().describe("Registration deadline: YYYY-MM-DD (end of day IST) or full ISO date-time"),
  rounds: z.array(z.string()).optional().describe("Ordered recruitment rounds, e.g. ['Online Assessment','Technical Interview','HR Interview']"),
};

export function buildServer() {
  const s = new McpServer({ name: "placementos", version: "1.0.0" },
    { instructions: "PlacementOS runs campus recruitment drives. Use create_drive to turn a coordinator's instructions into a draft drive, publish_drive to open registration and get the public student link, list_applicants / update_applicant_status to manage candidates. Never invent field values the user did not give; ask first. Drives created here are real and appear in the PlacementOS dashboard." });

  s.registerTool("create_drive", { title: "Create recruitment drive",
    description: "Create a new recruitment drive in PlacementOS as a DRAFT (not visible to students until publish_drive). Returns the saved drive with its id.",
    inputSchema: driveShape, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false } },
    run((a) => svc.createDrive(a, A)));

  s.registerTool("get_drives", { title: "List recruitment drives",
    description: "List recruitment drives with status, deadline and applicant counts. Optionally filter by status or search by company/title.",
    inputSchema: { status: z.enum(["draft", "published", "archived"]).optional(), search: z.string().optional().describe("Matches company or job title") },
    annotations: { readOnlyHint: true } },
    run(async (a) => { const drives = await svc.listDrives(a); return { count: drives.length, drives }; }));

  s.registerTool("get_drive", { title: "Get recruitment drive", description: "Get full details of one recruitment drive by id.",
    inputSchema: { driveId: z.string().describe("Drive UUID from get_drives/create_drive") }, annotations: { readOnlyHint: true } },
    run((a) => svc.getDrive(a.driveId)));

  s.registerTool("update_drive", { title: "Update recruitment drive",
    description: "Update one or more fields of an existing drive (partial update; omitted fields are unchanged). Archived drives cannot be edited.",
    inputSchema: { driveId: z.string(), ...Object.fromEntries(Object.entries(driveShape).map(([k, v]) => [k, (v as z.ZodTypeAny).optional()])) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true } },
    run(({ driveId, ...fields }) => svc.updateDrive(driveId, fields, A)));

  s.registerTool("publish_drive", { title: "Publish recruitment drive",
    description: "Publish a draft drive so students can register. Returns the public registration URL to share. Fails if the deadline has passed.",
    inputSchema: { driveId: z.string() }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true } },
    run(async (a) => { const d = await svc.publishDrive(a.driveId, A); return { published: true, publicUrl: d.publicUrl, drive: d }; }));

  s.registerTool("list_applicants", { title: "List applicants",
    description: "List students registered for a drive, with optional status filter and search (name/roll number). Contact details (email, phone) are intentionally withheld here; view them in the PlacementOS dashboard.",
    inputSchema: { driveId: z.string(), status: z.enum(svc.STATUSES).optional(), search: z.string().optional(), limit: z.number().int().min(1).max(100).optional().describe("Max rows, default 50") },
    annotations: { readOnlyHint: true } },
    run(async (a) => {
      const r = await svc.listApplicants(a.driveId, { status: a.status, search: a.search, limit: a.limit ?? 50 });
      return { drive: r.drive, counts: r.counts, returned: r.applicants.length,
        applicants: r.applicants.map(({ id, name, rollNumber, department, cgpa, backlogs, graduationYear, status, registeredAt }) => ({ id, name, rollNumber, department, cgpa, backlogs, graduationYear, status, registeredAt })) };
    }));

  s.registerTool("update_applicant_status", { title: "Update applicant status",
    description: "Set an applicant's recruitment status to registered, shortlisted, rejected or selected. Persisted immediately and visible in the dashboard.",
    inputSchema: { applicantId: z.string().describe("Applicant UUID from list_applicants"), status: z.enum(svc.STATUSES) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true } },
    run(async (a) => { const x = await svc.updateApplicantStatus(a.applicantId, a.status, A); return { updated: true, applicant: { id: x.id, name: x.name, rollNumber: x.rollNumber, status: x.status } }; }));

  return s;
}

// Stateless Streamable HTTP: a fresh server+transport per request (safe for horizontal scaling and restarts).
export async function handleMcp(req: Request, res: Response) {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => { transport.close(); server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error("[mcp] transport error", e);
    if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
  }
}
