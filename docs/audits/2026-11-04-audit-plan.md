# Builder audit 2 — the plan (2026-11-04)

The owner, 2026-11-04: *"i think is time to do an audit … i have seen way too many errors on the builder, we can do it by sessions but we gotta make sure we hit everything."*

## Scope: everything, old and new

The owner, 2026-11-04: *"in general not only the new things."* The whole builder is audited: every live line, whatever its age. The last audit's fixed findings are re-checked too (a fix can expire when the layer under it moves). Only the parked old way (`parked/old-way/`) and the component kit's own files are out, and the coverage file lists them as excluded by name, so even that is explicit.

## Why now

- The last audit (`docs/audits/2026-10-17-builder-audit.md`, 264 kept findings) was read against the **router-and-lanes** builder. Since then the **site agent** replaced the router (2026-11-02), and the old way is parked (`parked/old-way/`). About **24,000 lines** of `public/`, `worker.js` and `builder/` changed since 2026-10-24.
- One evening on Market Lane (2026-11-04) found four bugs, all in the new layer: edits sent the agent no conversation; Stop was nowhere for one message; finished steps vanished; Cancel on the key box was forgotten on refresh. Each was a **wire between two parts** that no test crossed. That is what this audit hunts.

## How "we hit everything" is guaranteed

Three nets, each checked by a script, not by memory:

1. **Every line has an owner.** Session 0 writes `docs/audits/2026-11-04-coverage.json`: every live file under `public/`, `builder/` (not `builder/lovable/template/`, the kit) and `worker.js`, cut into ranges, each range assigned to exactly one area below. A script (`scripts/audit-coverage.mjs`) fails if any line is unassigned or assigned twice. An area is done only when its ranges are marked read.
2. **Every journey is walked end to end.** The customer journeys below are traced across files (browser → Worker → container → storage → back to the screen). Tonight's bugs were all crossings; line-by-line reading alone misses them.
3. **Every cross-cutting rule is checked everywhere.** The owner's standing rules (below) are each checked across the whole codebase in one pass, not left to whichever area happens to see them.

## The areas (by code)

| # | Area | Main code |
|---|---|---|
| 1 | The site agent: its loop, tools, prompt, history, rounds, cost | `builder/site-agent.mjs`, `agent-steps.mjs`, `one-reply.mjs` |
| 2 | Requests: one message = one request, splits, parts, queue, resume, ends | `builder/request.mjs`, the request routes in `worker.js` |
| 3 | First build: new project, conversation first, start_build, pages, keys first | `worker.js` build routes, `builder/page-gen.mjs`, `site-plan.mjs` |
| 4 | Edits through the agent: apply, compile, render check, save to draft | `builder/site-apply.mjs`, `edit-job.mjs`, `site-render.mjs` |
| 5 | Containers and jobs: lease, deadline, gateway, recovery sweeps | `builder/build-server.mjs`, job routes, `docs/containers-and-jobs.md` |
| 6 | Draft, preview, Publish, versions, restore | `builder/publish-pages.mjs`, preview routes |
| 7 | The site's database, server code, keys (Stripe, mail) | `site-db.mjs`, `site-requirements.mjs`, secrets routes |
| 8 | Credits and billing: reserve, charge, refund, balance shown | ledger routes, `use_credits` |
| 9 | The chat page: thread, cards, steps, replies, questions | `public/chat.js` (thread and request parts) |
| 10 | The composer: Send/Stop, queue chips, attachments, picker, effort | `public/chat.js` (composer parts) |
| 11 | Workspace: preview frame, Code tab, devices, history clock, Share | `public/chat.js` (workspace parts), `site-zip.js` |
| 12 | Sync: what the server keeps, what only the browser keeps, devices, tabs | `chat.js` storage, `/api/site/chat`, account sync |
| 13 | Sign-in, accounts, ownership on every route | `auth.js`, `worker.js` owner checks |
| 14 | The published site: addresses, redirects, head, forms, visitor data | site serving in `worker.js` |
| 15 | Pictures, media, uploads | `site-picture.mjs`, `site-images.mjs`, media routes |
| 16 | Live progress talk and replies | `site-progress.mjs`, `site-reply.mjs`, narration |
| 17 | Add-ons: kinds, requirement report, provisioning, what each adds | `builder/site-add.mjs`, `docs/addon-path.md` |
| 18 | Site structure and look: nav and menus, pages, bands, theme, components | `site-nav.mjs`, `page-bands.mjs`, `site-theme.mjs`, `component-api.mjs`, `site-lanes.mjs` |
| 19 | Owner tools: Data panel, Inbox, SEO and head, QR codes, domains, Share | their routes in `worker.js`, their panels in `chat.js` |
| 20 | Deploy and safety nets: workflows, the canary, image predictor, rollback | `.github/`, `scripts/`, `docs/deploy.md` |
| 21 | The last audit's 264 findings: each one still fixed? | `docs/audits/2026-10-17-builder-audit.md` and its fix records |
| 22 | Everything left over | whatever the coverage file shows unassigned after 1–21 |

## The journeys (end to end)

- J1 Start a new site from a description; it talks first, then builds; first look at the preview.
- J2 Ask a question about the site ("what is Loading goods?"); nothing changes; nothing charged beyond the talk.
- J3 A follow-up that refers back ("delete that", "make it bigger").
- J4 An edit that needs a key: keys first, Keys added / Build it anyway, Cancel.
- J5 Two messages at once: the queue, two tasks, the panel, Stop each, Stop all.
- J6 Stop at every moment: routing, building, saving, publishing.
- J7 Reload or open on a second device mid-work and after it ends.
- J8 Publish, then restore an older version.
- J9 A shop: products load, checkout, Stripe, the order recorded (the stuck "Loading goods…").
- J10 Run out of credits halfway; top up; resume.
- J11 Delete a site; reuse its name.
- J12 Add something new ("add a booking page"): the add-on, its database, its keys.
- J13 Owner tools: read and change a row in the Data panel, read the Inbox, set the SEO text, make a QR code.
- J14 A visitor on the published site: forms, sign-in, booking, a paid order.

## The standing rules (checked across everything)

- Nothing only in the browser (owner, 2026-10-20 and 2026-11-04).
- A failed read is never an answer ("no tables", "free", "done").
- What a reply says comes from what was really done.
- Stop is always reachable while work runs.
- No secret value is ever stored outside the vault or shown back.
- The owner's money: no charge without the work, every refund taken back on failure.
- A test's fixture comes from its real producer (tonight's steps bug passed a test built by hand).

## Rules for the audit itself

- **Read and probe only, offline.** No paid run, model call or press without the owner's word. Live checks wanted are written down as proposals with exact requests and cost estimates.
- **Every finding has**: the area, file and line, what the customer sees, a concrete way it happens, severity (critical / high / medium / low), and confidence. Each critical and high one is checked by a second, independent reader before it is kept.
- **Findings go to** `docs/audits/2026-11-04-builder-audit.md`, one section per area.
- **Then fixing**, as last time: ten at a time in plain English, then each fixed with a red test, the suite and records.

## Sessions

| Session | What |
|---|---|
| 0 | The coverage file and its script; the journeys' file paths; agree the areas. |
| 1 | Areas 1–2 (agent, requests) + J2, J3 |
| 2 | Areas 3–4 (first build, edits) + J1 |
| 3 | Areas 9–10 (chat page, composer) + J5, J6 |
| 4 | Areas 11–12 (workspace, sync) + J7 |
| 5 | Areas 5–6 (containers, draft and publish) + J8 |
| 6 | Areas 7–8 (database, keys, credits) + J4, J9, J10 |
| 7 | Areas 13–16 (accounts, published site, media, talk) + J11 |
| 8 | Areas 17–18 (add-ons, site structure and look) |
| 9 | Areas 19–20 (owner tools, deploy and safety nets) |
| 10 | Area 21 (the last audit re-checked) |
| 11 | Area 22 (leftovers), the standing rules sweep, the coverage script green, the report and fix order. |

Each session ends with its findings written, its coverage ranges marked, and a short plain-English summary for the owner.
