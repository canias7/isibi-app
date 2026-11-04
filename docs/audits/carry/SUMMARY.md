# Carry-over check — what the old way protected, and whether the agent still does (2026-11-04)

The owner, 2026-11-04: switching to the big agent changed who decides, not what the builder does; every protection the old way had must exist on the agent path. Five readers read all 324 parked test files (`parked/old-way/test/`, ~113,000 lines) and checked each protection against the agent path today: `slice-00-findings.md` … `slice-04-findings.md`.

**195 protections after merging within slices** (31 + 38 + 41 + 39 + 46): **YES 92 · PARTLY 41 · NO 17 · UNKNOWN 14 · N/A 31** (only made sense for the router and lanes). Merged across slices below, the NO and PARTLY items come to **33 distinct gaps**.

Verified by me before keeping: the outage build (worker.js `newProjectTurn` answers `intent:"build", failed:true`; the page builds on it), the shell-tool bypass (`syncFromRun` never calls `outOfScope`), the charge on asking (`runAgentChange`'s `ag.ask` branch returns `cost: await charge()`), refused columns reported as added (`applyAgentSchema` awaits `applySiteSchema` and discards its answer, then returns `merged.added`), history (12 × 600 chars, no marker), no chat id on the request path.

## Gone (NO) — merged, 12

| # | Protection the old way had | What the agent path does instead | Cost if missing |
|---|---|---|---|
| G1 | Provider down → "waiting", a notice, resumes by itself | New project: answers "build" and starts a **paid build**. Edit: retries once, ends "agent-stopped", the customer must resend | credits, trust |
| G2 | A question to the owner is free while it waits | The agent's run up to the question is **charged**; files it wrote before asking are thrown away and still charged | credits |
| G3 | A side question while a question waits is not taken as the answer | Every message beside a waiting question is marked `answered:true` and resumes the waiting part with it | trust, credits |
| G4 | The model sees all the conversation it needs, or knows it doesn't | Last 12 messages × 600 chars, cut silently; on the request path **no history at all** (no chat id) | trust, credits |
| G5 | "Phones only" changes are checked not to move the desktop layout | Never checked on the agent path (`devices` never set) | trust |
| G6 | A new style rule that matches nothing is held, fixed once, or refused | Shipped and charged (`verifyCss` not passed) | credits |
| G7 | A file the build had to put back (salvage) is not reported as changed, and is refunded | Reply still says "Saved changes to X"; whole usage charged | credits, trust |
| G8 | No database is made / changed before the pages compile | Tables and columns are applied first and stay when the compile fails; the reply says "untouched" | data, trust |
| G9 | Refused database columns are not reported as added | Reported as added; pages may be written against a missing column | trust, broken pages |
| G10 | Shell commands obey the same write limits as the write tool | `run` → `syncFromRun` skips scope and home-page checks (`rm index.tsx` reaches the save) | data |
| G11 | A reply only claims what really happened | One-part reply is the agent's own summary; failed rows/rules/address can be claimed as done | trust |
| G12 | No emoji or checkmarks in what the customer is told | No emoji rule in the agent's or reply writer's instructions; the summary is shown as written | trust |

## Only partly (PARTLY) — merged, 21

| # | Protection | What's missing |
|---|---|---|
| P1 | A question never changes the site | Prompt rule only; any write on a question is saved and charged |
| P2 | An edit of one page touches only that page | Enforced only for split parts that name routes; a whole message has no scope |
| P3 | Unasked removals (text, links, sections, components, photos) are refused | Shown to the agent once at finish; a second finish publishes the loss; photos only reported after publishing |
| P4 | Balance checked before each paid step; a failed read is not "can afford" | Checked every 5 rounds; a failed read counts as affordable; helpers can overspend |
| P5 | The customer is asked before an expensive change (rewrite, new feature) | No yes needed; the agent can rewrite every file (previous version stays saved) |
| P6 | Ambiguous requests are asked about, not guessed | No rule tells the agent to ask when unsure |
| P7 | "Never invent facts" (names, prices, addresses) checked in code | Prompt rule only; the old grounding check and judgment pass are gone |
| P8 | Unreadable attachments refuse before anything runs | The agent is told and carries on |
| P9 | Links to pages the site doesn't have are refused | No dead-link check; removing a page others link to is not checked |
| P10 | Logo/upload checked by bytes and size | Extension only |
| P11 | Repeated questions and the total-answer limit | Not enforced on `ask_owner`; add-ons pass no earlier answers and cannot ask |
| P12 | Dependent parts run in order, with "waiting for /x" | `split_work` assumes independence; no order |
| P13 | Partial removals (one language, one QR) keep the rest, said when not found | Up to the model; nothing tells the customer a named item wasn't there |
| P14 | "I can't make pictures" said honestly | Depends on the model (no picture tool) |
| P15 | Every requirement checked and anything not done named | No per-requirement check; relies on the agent's summary |
| P16 | Render check holds publishing until the page shows | Holds finish once, then lets go |
| P17 | Read a file before overwriting it | Prompt only |
| P18 | Redelivered jobs write the same rows | Row journal keyed by position; a re-run model answer can differ |
| P19 | "Nothing was saved" is true when it is said | Schema changes applied earlier stay (with G8) |
| P20 | Data replies show before/after values | Counts only |
| P21 | A missing page or unreachable database is not charged | Charged |

## UNKNOWN (14, listed in the slice files)
Not traced far enough to call: first-build question limits and expired questions; whether the agent edits the draft or the live page; a timeout's attribution; a typed "publish"; an empty/over-long first message; seeded rows in the first build's reply; the contact-form diff; the security "Fix it" wiring; a job dying mid-save; an unreadable page list; uploads named by a new build's message; an old upload after a picture removal; progress lines claiming before the save; a site whose first build never finished.

## Also found
Two repository checks were parked with the old tests and no longer run (no `node_modules` tracked; model ceilings named); they belong back in `test/`.
