# Builder audit 2 — the plan (2026-11-04)

The owner, 2026-11-04: *"i think is time to do an audit … i have seen way too many errors on the builder, we can do it by sessions but we gotta make sure we hit everything."*

## Scope: everything, old and new

The owner, 2026-11-04: *"in general not only the new things."* The whole builder is audited: every live line, whatever its age. The last audit's fixed findings are re-checked too (a fix can expire when the layer under it moves). Only the parked old way (`parked/old-way/`) and the component kit's remaining files are out, and the coverage file lists them as excluded by name, so even that is explicit.

## Why now

- The last audit (`docs/audits/2026-10-17-builder-audit.md`, 264 kept findings) was read against the **router-and-lanes** builder. Since then the **site agent** replaced the router (2026-11-02), and the old way is parked (`parked/old-way/`). About **24,000 lines** of `public/`, `worker.js` and `builder/` changed since 2026-10-24.
- One evening on Market Lane (2026-11-04) found four bugs, all in the new layer: edits sent the agent no conversation; Stop was nowhere for one message; finished steps vanished; Cancel on the key box was forgotten on refresh. Each was a **wire between two parts** that no test crossed. That is what this audit hunts.

## How "we hit everything" is guaranteed

Three nets, each checked by a script, not by memory:

1. **Every line has an owner.** Session 0 writes `docs/audits/2026-11-04-coverage.json`: **every file of the builder** (the files the areas name, everything under `builder/` but the parked old way, the builder's parts of `worker.js` and `public/chat.js`), cut into ranges, each range assigned to exactly one area below. A script (`scripts/audit-coverage.mjs`) lists the files from `git ls-files` itself and fails if any file or line is unassigned or assigned twice. A file is left out only by name in the coverage file's `excluded` list, each with its reason (pictures, generated lists, the component kit's remaining files, docs that are records), so a new file can never slip past. An area is done only when its ranges are marked read.
2. **Every journey is walked end to end.** The customer journeys below are traced across files (browser → Worker → container → storage → back to the screen). Tonight's bugs were all crossings; line-by-line reading alone misses them.
3. **Every cross-cutting rule is checked everywhere.** The owner's standing rules (below) are each checked across the whole codebase in one pass, not left to whichever area happens to see them.

## The areas: the builder only

The owner, 2026-11-04: *"i want to audit the builder dude."* Only what happens from the moment a customer types a message until their site is built, changed or published, and that the site it makes works. Out of scope: the landing, pricing and legal pages, the phone-app builder, deploys and workflows, sign-in and accounts, domains, the owner tools (Data panel, Inbox, SEO, QR), and auditing the tests themselves. The last audit's findings are re-checked inside each area, not as an area of their own.

| # | Area | Main code |
|---|---|---|
| 1 | The AI agent: how it reads a message, what it remembers, its tools, rounds, cost | `builder/site-agent.mjs`, `agent-steps.mjs`, `agent-server-tools.mjs`, `one-reply.mjs` |
| 2 | Requests: one message = one job, splits, the queue, resume, how a job ends | `builder/request.mjs`, the request routes in `worker.js` |
| 3 | First build: talking first, start_build, pages, keys first | build routes in `worker.js`, `page-gen.mjs`, `site-plan.mjs` |
| 4 | Edits and additions: apply, compile, repair, the browser check, save to draft | `site-apply.mjs`, `edit-job.mjs`, `site-render.mjs`, `compile-repair.mjs`, `site-add.mjs` |
| 5 | Where the work runs: containers, time limits, recovery after a crash | `build-server.mjs`, job routes |
| 6 | Draft, preview, Publish, versions, restore | `publish-pages.mjs`, `site-draft.mjs`, `site-versions.mjs`, preview routes |
| 7 | What a site can do: its database, server code, keys, payments, mail | `site-db.mjs`, `server-code.mjs`, `site-requirements.mjs`, `site-secrets.mjs` |
| 8 | Credits while building: reserve, charge, refund | the agent's billing, ledger routes |
| 9 | The chat: messages, cards, progress steps, replies, questions | `public/chat.js`, `edit-poll.js`, `chat-talk.js` |
| 10 | The message box: Send/Stop, queue, attachments, picker, effort, the key box | `public/chat.js`, `key-card.js` |
| 11 | The workspace: preview, Code tab, devices, history, and what is kept on the server | `public/chat.js`, `/api/site/chat` |
| 12 | Progress talk and replies: do they tell the truth | `site-progress.mjs`, `site-reply.mjs`, narration |
| 13 | Look and pictures: menus, pages, theme, photos, uploads | `site-nav.mjs`, `site-theme.mjs`, `site-picture.mjs`, `site-images.mjs` |
| 14 | The AI's instructions: clear, current, not contradicting each other | the prompts in `builder/` and the guides they read |
| 15 | The site it makes: the code every built site runs | `builder/lovable/template/src` |

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
- J12 Add something new ("add a booking page"): the add-on, its database, its keys.
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
| 0 | The coverage map of the builder's files; agree the areas. |
| 1 | Areas 1–2 (agent, requests) + J2, J3 |
| 2 | Areas 3–4 (first build, edits and additions) + J1, J12 |
| 3 | Areas 9–10 (chat, message box) + J4, J5, J6 |
| 4 | Areas 11–12 (workspace, progress and replies) + J7 |
| 5 | Areas 5–6 (where the work runs, draft and publish) + J8 |
| 6 | Areas 7–8 (what a site can do, credits) + J9, J10, J14 |
| 7 | Areas 13–15 (look and pictures, instructions, the site it makes), the standing rules sweep, the report and fix order. |

Each session ends with its findings written and a short plain-English summary for the owner.

## What reading cannot cover (said, not hidden)

- **What the models really do.** Reading shows what the agent is told and what the code does with its answer; how often a real model misreads a message is only measured live. Live checks are proposed with costs, never run without the owner's word.
- **Production's own state**: data already stored wrong, keys, the live database. Read-only queries are allowed (non-secret columns); anything that writes asks first.
- **Third parties** (Stripe, Neon, Cloudflare, xAI) behaving differently from their documentation.
