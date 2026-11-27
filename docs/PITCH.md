# 5-minute founder pitch (target 4:40–4:50 – leave buffer under the 5:00 cap)
Fill every `[[...]]` with real facts. Do **not** invent achievements. Facts already known: B S Harsha Vardhan, final-year CSE at SITAMS, Placement Student Chief Coordinator at SITAMS.

## 1. Who I am (0:00–0:45)
"I'm Harsha – B S Harsha Vardhan – a final-year computer science student at SITAMS. I'm also the Placement Student Chief Coordinator there, which means I have personally watched how a campus drive actually runs: a company's requirements arrive in a message, someone copies them into a spreadsheet, someone else builds a Google Form, and then we chase students on WhatsApp. [[One concrete, true personal detail: e.g. how many drives you've coordinated / what went wrong once]]. I build full-stack products, and I decided to fix this problem properly."

## 2. My best work (0:45–1:15)
"The work I'm proudest of is [[pick ONE real project: e.g. SBGL Certificate Studio / ProctorIQ / InternHub / RECLAIM]]. It [[what it does]], and [[true outcome or metric – leave out if you have none]]. What it taught me: [[one lesson]] – and that's exactly how I approached PlacementOS."

## 3. Why PlacementOS wins (1:15–2:15)
"PlacementOS turns recruitment instructions into live campus hiring operations. The coordinator just *tells Claude* about a drive. Claude creates it in PlacementOS through MCP – and the work doesn't vanish when the chat ends. It's a real system: dashboard, public registration page, eligibility checks, applicant tracking.
Three reasons it wins. One: zero AI in our product. No model, no API keys – the college's own Claude subscription does the thinking, so our cost per customer doesn't grow with usage. Two: it meets coordinators where they already are – describing work in plain language – while keeping a proper source of truth that humans can edit. Three: every rule – eligibility, duplicates, status – lives in one backend that Claude and the dashboard both use, so nothing Claude does can be inconsistent with what the college sees."

## 4. Live demo (2:15–4:15) – rehearse; screen-record as backup
| Time | Show | Say |
|---|---|---|
| 2:15 | Claude chat with PlacementOS connector on. Paste the demo prompt (README). | "One paragraph, the way a coordinator would write it." |
| 2:35 | Claude's tool call `create_drive` expanding, then `publish_drive`. | "Real MCP tool calls – validated server-side, saved in PostgreSQL." |
| 3:00 | Dashboard → drive appears, badge "via Claude", activity feed. | "Created by Claude, now in our system. No copy-paste." |
| 3:15 | Open drive → Details → change CTC → Save. | "The coordinator stays in control." |
| 3:30 | Publish state / copy live student link; open on phone-size window; register a student; show an ineligible student getting a clear reason. | "Eligibility is enforced on the server, duplicates blocked." |
| 3:50 | Dashboard applicants → set status Shortlisted; back in Claude: "list the applicants". | "Both sides see the same data." |
Fallback if live Claude is slow: play the pre-recorded clip. Never narrate something that isn't on screen.

## 5. The money (4:15–5:00 → aim to finish 4:50)
"Starter is ₹1,499 a month, Professional ₹2,999, Institutional custom annual. Infrastructure for the whole stack is roughly ₹1,150 a month today – and AI inference is ₹0, because the customer's own Claude does it. Once I add multi-tenancy, one deployment serves many colleges and margins become software margins. I'll win the first customers by running real drives at my own college and offering the first drive free to neighbouring colleges. These numbers are hypotheses; my next milestone is [[true next step, e.g. pilot at SITAMS]]. I'm [[name]] – thank you."
