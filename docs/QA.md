# QA results & known limitations

## What was actually run (local sandbox: Node 22, PostgreSQL 16.15)
| Suite | Result |
|---|---|
| `server/test/e2e.ts` – real MCP SDK client over HTTP + REST, real Postgres | **63 / 63 pass** |
| Browser (headless Chromium) end-to-end UI flow | **22 / 22 pass** |
Covered: auth (wrong password, tampered token, no token), MCP secret check, exactly 7 tools with JSON schemas, create/get/list/update/publish via MCP persisted in Postgres (verified by direct SQL), dashboard sees MCP data and vice-versa, past-deadline publish refused, eligibility (CGPA, department, batch, backlogs), duplicate email (case-insensitive) and duplicate roll number, malformed phone/email/missing fields, SQL-injection-shaped id, applicant status changes via MCP and dashboard, archive/restore rules, data survives a fresh DB connection, mobile layout (390px), no console errors.

## Bugs found by this testing and fixed
1. `update_drive`/PATCH silently **reset omitted fields to defaults** (zod `.partial()` keeps `.default()`), which also let an ineligible student register. Fixed (defaults only on create) + regression assertions.
2. Mobile header overflowed at 390px. 3. Dashboard grid overflowed on mobile with long titles. Both fixed.

## NOT done / NOT verified (be honest in the submission)
- **Not deployed.** The build sandbox cannot reach Render/GitHub. `render.yaml` is unvalidated. No public URL exists until you deploy.
- **Not connected from real Claude.ai.** Transport was verified with the official MCP client SDK, not Claude's connector UI. Do this first after deploying.
- Restart persistence verified only at DB-connection level, not a Render redeploy.
- No load testing.

## Known limitations
- **Single tenant**: one admin login, no per-college isolation. Multi-tenant (orgs, users, roles) is the first post-MVP milestone.
- MCP auth is a secret URL, not OAuth (anyone with the URL can act as the coordinator).
- Department eligibility is exact-string (case-insensitive): "CSE" ≠ "Computer Science".
- Phone validation accepts Indian mobile numbers only; no email verification/notifications; no CSV export; rate limiter is in-memory (per instance).
- Registration deadline entered in the dashboard uses the browser's time zone; date-only values via Claude mean end of day IST.
