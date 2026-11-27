# Final submission checklist
(Deliverable list inferred from the brief – the Volopay PDF was not attached to the build session; re-check against it.)

## Built & verified in the sandbox
- [x] Source code (this repo, committed locally with git)
- [x] Seven MCP tools over Streamable HTTP; official SDK; no AI keys/models in code
- [x] Dashboard, drives CRUD/publish/unpublish/archive, public registration, applicant tracking
- [x] PostgreSQL schema + auto-migration; `/healthz`
- [x] Tests: 63/63 API+MCP, 22/22 browser (see QA.md)
- [x] README, pitch script, business model, QA report

## Remaining – requires YOUR accounts (cannot be done from the build sandbox)
- [ ] Push to GitHub: `git remote add origin <url> && git push -u origin main`
- [ ] Deploy to Render (README → Deploy); set `ADMIN_PASSWORD`, `MCP_SECRET` (`openssl rand -hex 24`)
- [ ] `curl https://<host>/healthz` → ok; `MCP_URL=https://<host>/mcp/<secret> npx tsx scripts/mcp-check.ts` lists 7 tools
- [ ] Add the connector in Claude (Settings → Connectors → Add custom connector) and run the demo prompt end-to-end **on the deployed URL**
- [ ] Redeploy once and confirm data persists
- [ ] Record the ≤5-minute pitch video (docs/PITCH.md); fill all `[[placeholders]]` truthfully
- [ ] Submit: live app URL · MCP URL + connection instructions · pitch video · (test login: ADMIN_EMAIL / ADMIN_PASSWORD you set)
- [ ] Change nothing in the pitch that claims "deployed/tested" until the boxes above are ticked
