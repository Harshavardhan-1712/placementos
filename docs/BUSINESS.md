# Business model (hypotheses, not validated results)

**Legend:** ✅ = verified fact, 🟡 = assumption to test. No customers, revenue or partnerships exist yet. No market-size statistics are claimed.

## Pricing hypothesis 🟡
| Plan | Price | Intended for |
|---|---|---|
| Starter | ₹1,499 / month | One placement cell, a handful of drives per season |
| Professional | ₹2,999 / month | High drive volume, more coordinators/exports (post-MVP features) |
| Institutional | Custom, annual | Universities / multi-department / multi-campus, SSO, support SLA |
Assumed exclusive of GST (🟡 confirm applicability with a CA).

## Infrastructure cost
- ✅ Render list prices found during build: web service *Starter* $7/month (512 MB, always-on); an Render article reports "about $13/month" for an always-on Starter web service + Basic-256mb Postgres (July 2026). 🟡 Re-check on render.com/pricing before budgeting – prices change.
- 🟡 FX assumed ₹88/US$ → baseline ≈ **₹1,150 / month** for the whole stack.
- ✅ **AI inference cost: ₹0.** The app contains no model and no AI API key; the coordinator's own Claude subscription does the reasoning. (Risk: the customer must have a Claude plan that supports custom connectors – an adoption dependency, see below.)
- 🟡 Payment gateway fees ≈ 2–3% of revenue; email/SMS not built yet (would be extra).

### Per-customer cost depends on tenancy
| Mode | Infra per customer | Margin at Starter ₹1,499 |
|---|---|---|
| **Today's MVP (single-tenant, 1 deployment per college)** | ≈ ₹1,150 | ≈ 20–25% before gateway fees – thin |
| **Multi-tenant (post-MVP, many colleges per deployment)** 🟡 | ₹1,150 ÷ N, plus step-ups as load grows (load capacity untested) | > 80% plausible once N ≥ ~10 |
Takeaway: the margin story depends on shipping multi-tenancy; zero AI spend is what makes that margin possible, because a typical AI-in-the-app competitor carries variable inference cost per drive created.

## First 100 customers 🟡
1. **Pilot at own college** (SITAMS – the founder is Placement Student Chief Coordinator): run real drives on PlacementOS, record before/after coordinator hours. *Plan only – not yet done.*
2. **Founder-led outreach** to placement officers/coordinators at neighbouring colleges via the student-coordinator network (e.g. AWS Student Builder Group and similar communities); offer the first drive free.
3. **Demo-led content**: the 90-second "Claude prompt → live drive" clip is the product – post on LinkedIn/YouTube/WhatsApp groups of placement coordinators.
4. **Season timing**: sell 4–6 weeks before campus-hiring season when spreadsheets hurt most.
5. **Referrals**: one free month for each referred college.
6. Funnel arithmetic (all 🟡): 100 customers ÷ 30% pilot→paid = 333 pilots ÷ 10% outreach→pilot ≈ 3,300 outreaches over ~12–18 months.

## Projections – scenarios built only from the assumptions above 🟡
| | Mix | Exit ARR |
|---|---|---|
| **Year 1** | 8 Starter + 3 Professional + 1 Institutional @ ₹60,000/yr | 8×17,988 + 3×35,988 + 60,000 = **₹3,11,868 (~₹3.1 lakh)** |
| **Year 3** | 70 Starter + 40 Professional + 10 Institutional @ ₹80,000/yr | 70×17,988 + 40×35,988 + 800,000 = **₹34,98,680 (~₹35 lakh)** |
These are illustrative targets, not forecasts; the Institutional prices are placeholders. Largest risks: needing a Claude subscription per coordinator, long college buying cycles, seasonality.
