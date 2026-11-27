# PlacementOS

Campus-recruitment operations SaaS. A placement coordinator describes a drive to **Claude**; Claude creates it in PlacementOS through a **remote MCP server**; the team then edits, publishes and manages it in the dashboard. **There is no AI inside this application** – no model, no AI API key. Inference runs on the customer's own Claude subscription.

```
Claude ──MCP (Streamable HTTP)──▶ ┐
Dashboard (React) ──REST──────────▶ ├─▶ service.ts (single source of business rules) ─▶ PostgreSQL
Student page (React) ──REST───────▶ ┘
```
One Node/Express process serves the API, the MCP endpoint and the built React app.

## Stack
React + Vite + Tailwind · Node 20+/Express · official `@modelcontextprotocol/sdk` (stateless Streamable HTTP) · PostgreSQL (`pg`) · zod validation · Render.

## MCP tools (7)
`create_drive` · `get_drives` · `get_drive` · `update_drive` · `publish_drive` (returns public URL) · `list_applicants` (email/phone withheld) · `update_applicant_status`.
No delete/archive tool is exposed to Claude by design – destructive operations stay in the dashboard.

## Local development
```bash
npm install
# need a Postgres; e.g. docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=placementos postgres:16
cp .env.example .env   # or export the variables; see below
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/placementos \
       ADMIN_EMAIL=admin@placementos.app ADMIN_PASSWORD=Demo-Pass-2026 \
       SESSION_SECRET=$(openssl rand -hex 32) MCP_SECRET=$(openssl rand -hex 24)
npm run dev:server     # API+MCP on :8080 (auto-migrates on boot)
npm run dev:web        # Vite on :5173, proxies /api to :8080
```
Production-style run: `npm run build && NODE_ENV=production npm start` → http://localhost:8080.

## Database
Schema lives in `server/src/migrate.ts` (idempotent `CREATE ... IF NOT EXISTS`), applied automatically at every boot; run manually with `npm run migrate`. Tables: `drives`, `applicants` (unique per drive on lower(email) and lower(roll_number)), `activity`.

## Tests
`npm run test:e2e` – runs against the `DATABASE_URL` database (**truncates its tables – use a throwaway DB**). Uses the real MCP SDK client over HTTP. 63 assertions.

## Deploy to Render
**Blueprint:** push to GitHub → Render → New → Blueprint → select the repo (uses `render.yaml`). Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `MCP_SECRET` (`openssl rand -hex 24`) when prompted.
**Manual:** create a PostgreSQL instance; create a Web Service (Node) with build `npm ci --include=dev && npm run build`, start `npm start`, health check `/healthz`, plan *Starter* (free plans sleep → MCP timeouts); env vars as in `.env.example` (`DATABASE_URL` = the DB's *Internal* URL). `PUBLIC_BASE_URL` defaults to Render's `RENDER_EXTERNAL_URL`; set it explicitly if you add a custom domain.
After deploy: `curl https://<host>/healthz` → `{"status":"ok","db":"up"}`.

## Connect Claude
1. Claude (claude.ai or desktop) → **Settings → Connectors → Add custom connector**.
2. Name: `PlacementOS`. URL: `https://<your-host>/mcp/<MCP_SECRET>`. Add. (No OAuth – the secret path segment is the credential; treat the URL like a password and rotate `MCP_SECRET` to revoke.)
3. In a chat, enable the PlacementOS connector under the tools menu.
4. Verify from a terminal any time: `MCP_URL=https://<host>/mcp/<MCP_SECRET> npx tsx scripts/mcp-check.ts`.

### Demo prompt
> Using PlacementOS, create a recruitment drive for Northwind Systems: Associate Software Engineer, Bengaluru, 10 LPA. CSE, IT and ECE students of the 2027 batch with at least 7.0 CGPA and no active backlogs. Rounds: online assessment, technical interview, HR interview. Registration closes on 20 December 2026. Then publish it and give me the student link.

Then open the dashboard → Drives, edit, share the link, register a test student, and ask Claude *"list the applicants and shortlist Meera"*.

## Security notes
Dashboard: single admin (env credentials), HMAC-signed 7-day token. MCP: secret-in-URL, constant-time compare, wrong secret → 404. Public registration rate-limited. All input validated server-side (zod); SQL fully parameterised. See `docs/QA.md` for limitations.
