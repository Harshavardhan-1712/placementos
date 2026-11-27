export {};
// End-to-end test against a REAL PostgreSQL (DATABASE_URL) and the REAL MCP SDK client over Streamable HTTP.
process.env.ADMIN_EMAIL = "admin@test.dev";
process.env.ADMIN_PASSWORD = "test-password-123";
process.env.SESSION_SECRET = "s".repeat(40);
process.env.MCP_SECRET = "m".repeat(32);
process.env.PUBLIC_BASE_URL = "http://placementos.test";
process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/placementos";

const { pool } = await import("../src/db.js");
const { migrate } = await import("../src/migrate.js");
const { createApp } = await import("../src/index.js");
const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");

let pass = 0, failN = 0;
const check = (name: string, cond: unknown, extra?: unknown) => { if (cond) { pass++; console.log("  ✓", name); } else { failN++; console.log("  ✗", name, extra ?? ""); } };

await migrate();
await pool.query("TRUNCATE activity, applicants, drives RESTART IDENTITY CASCADE");

const server = createApp().listen(0);
const base = `http://localhost:${(server.address() as any).port}`;
const http = async (method: string, path: string, body?: unknown, token?: string) => {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any; try { json = JSON.parse(text); } catch { json = text; } return { status: r.status, json };
};
const mcpUrl = `${base}/mcp/${"m".repeat(32)}`;
const connect = async () => { const c = new Client({ name: "e2e", version: "1" }); await c.connect(new StreamableHTTPClientTransport(new URL(mcpUrl))); return c; };
const call = async (c: any, name: string, args: any) => { const r = await c.callTool({ name, arguments: args }); const txt = (r.content as any)[0].text; return { isError: !!r.isError, data: JSON.parse(txt), structured: r.structuredContent }; };

console.log("\n[health & auth]");
check("healthz ok", (await http("GET", "/healthz")).json.db === "up");
check("login wrong password -> 401", (await http("POST", "/api/auth/login", { email: "admin@test.dev", password: "nope" })).status === 401);
check("drives without token -> 401", (await http("GET", "/api/drives")).status === 401);
const token = (await http("POST", "/api/auth/login", { email: "admin@test.dev", password: "test-password-123" })).json.token;
check("login ok returns token", typeof token === "string" && token.includes("."));
check("tampered token rejected", (await http("GET", "/api/drives", undefined, token.slice(0, -2) + "xx")).status === 401);

console.log("\n[MCP transport & tools]");
const bad = await fetch(`${base}/mcp/wrong-secret`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: "{}" });
check("wrong MCP secret -> 404", bad.status === 404);
const mcp = await connect();
const tools = (await mcp.listTools()).tools.map((t) => t.name).sort();
check("exactly the 7 required tools exposed", JSON.stringify(tools) === JSON.stringify(["create_drive", "get_drive", "get_drives", "list_applicants", "publish_drive", "update_applicant_status", "update_drive"]), tools);
const cd = (await mcp.listTools()).tools.find((t) => t.name === "create_drive")!;
check("create_drive has JSON input schema w/ required fields", (cd.inputSchema as any).required?.includes("company") && (cd.inputSchema as any).required?.includes("registrationDeadline"));

const invalid = await call(mcp, "create_drive", { company: "X", title: "Y", eligibleDepartments: [], graduationYear: 2027, registrationDeadline: "not-a-date", minCgpa: 11 });
check("create_drive invalid input -> isError with field details", invalid.isError && invalid.data.error === "validation_error" && invalid.data.details.length >= 3, invalid.data);
check("invalid create saved nothing", (await pool.query("SELECT count(*) FROM drives")).rows[0].count === 0);

const created = await call(mcp, "create_drive", {
  company: "Acme Technologies", title: "Software Engineer", description: "Build backend services.",
  eligibleDepartments: ["CSE", "IT"], graduationYear: 2027, minCgpa: 7.5, maxBacklogs: 0, ctc: "12 LPA", location: "Bengaluru",
  registrationDeadline: "2030-01-15", rounds: ["Online Assessment", "Technical Interview", "HR Interview"] });
check("create_drive succeeds, status draft", !created.isError && created.data.status === "draft" && created.data.id, created.data);
const id = created.data.id as string;
const row = (await pool.query("SELECT * FROM drives WHERE id=$1", [id])).rows[0];
check("PERSISTED in PostgreSQL by MCP call", row?.company === "Acme Technologies" && row.created_by === "claude" && row.rounds.length === 3);
check("date-only deadline = end of day IST", new Date(row.registration_deadline).toISOString() === "2030-01-15T18:29:59.000Z", row.registration_deadline);

check("get_drives returns it", (await call(mcp, "get_drives", {})).data.count === 1);
check("get_drives status filter", (await call(mcp, "get_drives", { status: "published" })).data.count === 0);
check("get_drive by id", (await call(mcp, "get_drive", { driveId: id })).data.company === "Acme Technologies");
check("get_drive unknown id -> not_found", (await call(mcp, "get_drive", { driveId: "00000000-0000-4000-8000-000000000000" })).data.error === "not_found");
check("get_drive garbage id -> not_found (no DB crash)", (await call(mcp, "get_drive", { driveId: "abc'; DROP TABLE drives;--" })).data.error === "not_found");
const upd = await call(mcp, "update_drive", { driveId: id, ctc: "14 LPA", minCgpa: 7 });
check("update_drive persists partial update", upd.data.ctc === "14 LPA" && upd.data.minCgpa === 7 && upd.data.company === "Acme Technologies" && (await pool.query("SELECT ctc FROM drives WHERE id=$1", [id])).rows[0].ctc === "14 LPA");
check("partial update does NOT reset other fields (regression)", upd.data.rounds.length === 3 && upd.data.description === "Build backend services." && upd.data.maxBacklogs === 0 && upd.data.location === "Bengaluru" && upd.data.eligibleDepartments.length === 2, upd.data);
check("update_drive with no fields -> error", (await call(mcp, "update_drive", { driveId: id })).isError);

await call(mcp, "update_drive", { driveId: id, registrationDeadline: "2020-01-01" });
const pastPub = await call(mcp, "publish_drive", { driveId: id });
check("publish with past deadline refused", pastPub.isError && pastPub.data.error === "deadline_passed");
check("refused publish left drive as draft", (await pool.query("SELECT status FROM drives WHERE id=$1", [id])).rows[0].status === "draft");
await call(mcp, "update_drive", { driveId: id, registrationDeadline: "2030-01-15" });
const pub = await call(mcp, "publish_drive", { driveId: id });
check("publish_drive returns public URL", pub.data.published === true && /^http:\/\/placementos\.test\/d\/acme-technologies-software-engineer-[0-9a-f]{6}$/.test(pub.data.publicUrl), pub.data);
const slug = pub.data.drive.slug as string;

console.log("\n[dashboard REST sees MCP data]");
const list = await http("GET", "/api/drives", undefined, token);
check("dashboard lists drive created by Claude", list.json.drives.length === 1 && list.json.drives[0].createdBy === "claude" && list.json.drives[0].status === "published");
const edit = await http("PATCH", `/api/drives/${id}`, { location: "Hyderabad", eligibleDepartments: ["CSE", "IT", "ECE"] }, token);
check("dashboard edit persists & keeps other fields", edit.json.location === "Hyderabad" && edit.json.eligibleDepartments.length === 3 && edit.json.minCgpa === 7 && edit.json.rounds.length === 3);
check("MCP sees dashboard edit (same data)", (await call(mcp, "get_drive", { driveId: id })).data.location === "Hyderabad");
check("REST validation error -> 400 w/ details", (await http("PATCH", `/api/drives/${id}`, { minCgpa: 99 }, token)).status === 400);
check("unknown field rejected (strict)", (await http("PATCH", `/api/drives/${id}`, { status: "archived" }, token)).status === 400);
check("unpublish -> draft", (await http("POST", `/api/drives/${id}/unpublish`, {}, token)).json.status === "draft");
check("draft drive not public", (await http("GET", `/api/public/drives/${slug}`)).status === 404);
check("re-publish", (await http("POST", `/api/drives/${id}/publish`, {}, token)).json.status === "published");

console.log("\n[public page & registration]");
const pubPage = await http("GET", `/api/public/drives/${slug}`);
check("public drive page data, no internal fields", pubPage.status === 200 && pubPage.json.company === "Acme Technologies" && pubPage.json.createdBy === undefined && pubPage.json.id === undefined && pubPage.json.registrationOpen === true);
const stu = { name: "Asha Rao", email: "Asha@College.edu", phone: "9876543210", rollNumber: "21CS001", department: "CSE", cgpa: 8.4, graduationYear: 2027, backlogs: 0 };
const reg = (over: object = {}) => http("POST", `/api/public/drives/${slug}/register`, { ...stu, ...over });
check("low CGPA -> 422 not_eligible", (await reg({ cgpa: 6.5, email: "a1@x.edu", rollNumber: "R1" })).json.error?.details?.[0]?.includes("CGPA"));
check("wrong department -> 422", (await reg({ department: "MECH", email: "a2@x.edu", rollNumber: "R2" })).status === 422);
check("wrong batch -> 422", (await reg({ graduationYear: 2026, email: "a3@x.edu", rollNumber: "R3" })).status === 422);
check("active backlog -> 422", (await reg({ backlogs: 1, email: "a4@x.edu", rollNumber: "R4" })).status === 422);
check("missing field -> 400", (await http("POST", `/api/public/drives/${slug}/register`, { name: "Only Name" })).status === 400);
check("bad phone -> 400", (await reg({ phone: "12345", email: "a5@x.edu", rollNumber: "R5" })).status === 400);
check("bad email -> 400", (await reg({ email: "nope", rollNumber: "R6" })).status === 400);
check("ineligible attempts saved nothing", (await pool.query("SELECT count(*) FROM applicants")).rows[0].count === 0);
const ok1 = await reg();
check("eligible student registers -> 201", ok1.status === 201 && ok1.json.ok === true, ok1.json);
check("duplicate (same email, different case) -> 409", (await reg({ email: "asha@college.edu", rollNumber: "OTHER" })).status === 409);
check("duplicate roll number -> 409", (await reg({ email: "other@college.edu" })).status === 409);
check("ALL-departments drive logic + 2nd student", (await reg({ name: "Ravi Kumar", email: "ravi@college.edu", phone: "+919123456780", rollNumber: "21IT007", department: "it", cgpa: 7.2 })).status === 201);
check("exactly 2 applicants persisted", (await pool.query("SELECT count(*) FROM applicants")).rows[0].count === 2);

console.log("\n[applicant management]");
const apps = await http("GET", `/api/drives/${id}/applicants`, undefined, token);
check("dashboard lists applicants w/ contact info", apps.json.applicants.length === 2 && apps.json.applicants[0].email && apps.json.counts.registered === 2);
const asha = apps.json.applicants.find((a: any) => a.rollNumber === "21CS001");
check("search by name", (await http("GET", `/api/drives/${id}/applicants?search=ravi`, undefined, token)).json.applicants.length === 1);
const la = await call(mcp, "list_applicants", { driveId: id });
check("MCP list_applicants OK & withholds email/phone", la.data.returned === 2 && la.data.applicants.every((a: any) => a.email === undefined && a.phone === undefined), la.data);
const us = await call(mcp, "update_applicant_status", { applicantId: asha.id, status: "shortlisted" });
check("MCP update_applicant_status", us.data.updated && us.data.applicant.status === "shortlisted");
check("invalid status rejected by MCP schema", await (async () => { try { const r = await mcp.callTool({ name: "update_applicant_status", arguments: { applicantId: asha.id, status: "hired" } }); return !!r.isError; } catch { return true; } })());
check("unknown applicant -> not_found", (await call(mcp, "update_applicant_status", { applicantId: "00000000-0000-4000-8000-000000000000", status: "selected" })).data.error === "not_found");
check("dashboard sees MCP status change", (await http("GET", `/api/drives/${id}/applicants?status=shortlisted`, undefined, token)).json.applicants[0].name === "Asha Rao");
check("dashboard status update persists", (await http("PATCH", `/api/applicants/${asha.id}/status`, { status: "selected" }, token)).json.status === "selected" && (await pool.query("SELECT status FROM applicants WHERE id=$1", [asha.id])).rows[0].status === "selected");
check("bad status via REST -> 400", (await http("PATCH", `/api/applicants/${asha.id}/status`, { status: "x" }, token)).status === 400);

console.log("\n[dashboard stats, archive]");
const dash = (await http("GET", "/api/dashboard", undefined, token)).json;
check("dashboard totals", dash.totals.drives === 1 && dash.totals.published === 1 && dash.totals.applicants === 2 && dash.applicantsByStatus.selected === 1, dash.totals);
check("upcoming deadlines + recent activity populated", dash.upcomingDeadlines.length === 1 && dash.recentActivity.length >= 5 && dash.recentActivity.some((a: any) => a.actor === "claude") && dash.recentActivity.some((a: any) => a.actor === "student"));
check("archive drive", (await http("POST", `/api/drives/${id}/archive`, {}, token)).json.status === "archived");
check("archived drive closed to registration", (await reg({ email: "late@x.edu", rollNumber: "L1" })).status === 404);
check("archived drive read-only", (await http("PATCH", `/api/drives/${id}`, { ctc: "1" }, token)).status === 409);
check("archived cannot be published", (await http("POST", `/api/drives/${id}/publish`, {}, token)).status === 409);
check("restore -> draft", (await http("POST", `/api/drives/${id}/restore`, {}, token)).json.status === "draft");

console.log("\n[restart persistence]");
await mcp.close(); server.close(); await pool.end();
const { Pool } = (await import("pg")).default;
const p2 = new Pool({ connectionString: process.env.DATABASE_URL });
const after = await p2.query("SELECT (SELECT count(*) FROM drives) d, (SELECT count(*) FROM applicants) a");
check("data survives process/connection restart", Number(after.rows[0].d) === 1 && Number(after.rows[0].a) === 2, after.rows[0]);
await p2.end();

console.log(`\n${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);
