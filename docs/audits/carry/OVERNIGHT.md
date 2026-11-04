# Overnight: the carry-over fixes (2026-11-04)

You asked before bed: *"schedule to finish all the missing ones pls."* This is what happened, gap by gap, against `docs/audits/carry/MASTER.md` (95 gaps).

Everything is on `claude/cool-fermat-a06gie`.
- Nothing is merged or deployed.
- No paid runs or AI calls were made.
- Each batch has its own entry in `docs/owner-notes.md`.

## In one paragraph

Of the 95 gaps:
- **66 are fixed**: 57 as code checks around the big agent, 9 as rules in its instructions (marked).
- **5 are closed by your decision** "charge every token".
- **3 wait on a decision from you**, plus the second half of one fixed gap (M-74).
- **21 are left open**, because each one is a new feature or needs its own step. Each is listed below with the reason.

The full suite now has **9,646 tests**. The only consistent failure is `media-verify`, which fails on `main` too. Two browser tests (`credit-pause-browser`, `request-talk-browser`) failed once or twice under load in the full run and pass every time on their own.

## What this means for you

- **No live run yet.** These are proven with scripted AI answers, not the real AI. How the real AI handles the new checks needs a live test, and a live test costs credits. Rough guesses:
  - a few edits on a test site: about 5–15 credits;
  - one fresh test site, for the server-code fix: about 11–45 credits.
- **More questions for you, by design.** The agent now asks before:
  - a new page, a new feature or a big rewrite (with the price);
  - choosing a provider;
  - removing things you didn't name;
  - picking a logo from several pictures;
  - changing a page you named that doesn't exist.
- **The container image will rebuild** on the next deploy: `builder/agent-gates.mjs` is new and part of it.

## Fixed

Batch numbers match the commits. Code = enforced in code. Rule = instruction to the AI only.

| Gap | What changed | How |
|---|---|---|
| M-13 … M-19 (critical) | Rows held for Publish; schema after compile; visitor rows protected; shell limits; data check; server code acts as the visitor | code (before tonight) |
| G1, G4 | Outage never builds; full chat history | code (before tonight) |
| M-7 | Price first: new page, new server code, or 4+ files changed needs "Yes, go ahead" on a question that states the credits | code, batch 1 |
| M-8 | Never chooses a provider (Stripe, PayPal, Twilio, Resend, OpenAI…) you didn't name | code, batch 1 |
| M-42 | Unasked removals: told once, then you're asked "take them away too?" | code, batch 1 |
| M-45 | New links to missing pages hold the finish twice, then the reply names them | code, batch 1 |
| M-66 | The reply adds what really failed ("What did not work: …") | code, batch 1 |
| M-90 | Ask when unclear; helpers mark gaps instead of guessing | rule, batches 1 and 4 |
| M-87 | A typed side question doesn't count as the answer to a waiting question | code, batch 2 |
| M-89 | A message that only asks a question can't change the site | code, batch 2 |
| M-22 | No duplicate entries without "Add it again" | code, batch 2 |
| M-20 | Long tables shown as whole rows, with "N of M shown" | code, batch 2 |
| M-38 | QR codes only for pages that exist | code, batch 2 |
| M-41 | Made-up picture addresses: held, then emptied (never a broken image) and told | code, batch 2 |
| M-70 | "Press Publish" after a draft save; the agent can't publish | code + rule, batch 2 |
| M-68 | Database refusals reported, never "added" | code, batch 3 |
| M-24 | Address moves or releases only on your exact words | code, batch 3 |
| M-88 | Expired or closed first-build answers never start a paid build | code, batch 3 |
| M-23 | No pasted HTML or outside scripts in pages (structured data allowed) | code, batch 3 |
| M-6 | Balance checked every round | code, batch 3 |
| M-39 | QR pictures put in by code; the AI never copies them | code, batch 3 |
| M-43 | A message naming one page changes only that page (plus header and footer) | code, batch 4 |
| M-44 | "Phones only" read from your words, so other widths are checked | code, batch 4 |
| M-46 | One-time reminders must be guarded to their year | code, batch 4 |
| M-67 | Quoted words you asked for must be on the site, or the reply says not | code, batch 4 |
| M-69 | Phone numbers, emails and prices nobody gave: held once, then "please check these" | code, batch 4 |
| M-21 | The agent's held database change is tried on a copy first | code, batch 4 |
| M-28 | No blind overwrite (read first, or keep most lines) | code, batch 5 |
| M-29 | Logo and pictures checked by stored type and size (≤ 5 MB) | code, batch 5 |
| M-30, M-79, M-81, M-85 | Reply cleaned: no keys, no "fal", no emoji, no version ids, no file names | code, batch 5 |
| M-33 | The agent is told today's date | code, batch 5 |
| M-36, M-5 | Server-set columns, required fields, allowed values and lengths refused before queueing | code, batch 5 |
| M-40 | Same QR address gives the same code; at most 12 per change | code, batch 5 |
| M-93 | The same question isn't asked twice | code, batch 5 |
| M-9, M-11 | Unreadable attachment stops before anything runs; an empty first message never reaches the AI | code, batch 5 |
| M-47, M-54 | Old tel: and mailto: links after a number or email changes: held, then told | code, batch 6 |
| M-48 | New page nothing links to: held, then told | code, batch 6 |
| M-64 | A named page the site doesn't have: the agent must ask before changing anything | code, batch 6 |
| M-71 | Files the build put back are told as unchanged | code, batch 6 |
| M-78 | Progress says "Writing… (saved when the change is done)", never "Wrote" before the save | code, batch 6 |
| M-95 | The node_modules repository check is back in the suite | test, batch 6 |
| M-51 | Several pictures as "my logo": the agent asks which | code, batch 7 |
| M-53 | Logo saved but no header shows it: held, then told | code, batch 7 |
| M-34 | The agent sees the tables your draft will make | code, batch 7 |
| M-37 | A failed put-back is logged and told | code, batch 7 |
| M-80 | Before and after values ("price 40 → 42") | code, batch 7 |
| M-57, M-58, M-59, M-63, M-75, M-77, M-82, M-84 | Photo remove vs keep space; footer details; additions match the design; ask where things go; no "watched your video"; no "made a picture"; short, ranked answers; one next step, never repeated | rule, batch 7 |
| M-74 | Provider outage mid-edit: work kept for a re-run of the part, the reply says the provider is down, nothing charged | code, batch 8 (partly; see below) |

## Closed by your decisions (not gaps)

- **M-1, M-2, M-3, M-4, M-12:** "charge for every token". The reply still says truthfully what was and wasn't done.

## Waiting on you

| Gap | The question |
|---|---|
| M-32 | Repair blank database links automatically? (you said "idk") |
| M-65 | May one message that splits into parts publish several times? |
| M-83 | You chose AI-written failure messages. Building it means an AI call on every failure; it should be tried live before it's on. |
| M-74 (rest) | A real "pause and continue" for outages (like the credit pause), instead of "send it again"? It's a new feature. |

## Left open, and why

| Gap | Why not tonight |
|---|---|
| M-10 | Whether the agent should skip its visual check for back-end-only work is up to the agent; low. |
| M-25, M-26 | Row writes after a redelivered job are journaled by position. A fix needs a new journal format and recovery tests on real jobs. |
| M-27 | Offering removed entries back needs a data undo. Saved versions don't restore rows, so it's a feature. |
| M-31 | Two parts changing the database at once: the scheduler needs to read the parts' database plans. A feature. |
| M-35 | Starter rows for a new table: needs a rule about which tables to seed (the display-only rule from the old way). |
| M-49 | A style rule that matches nothing: the old style check (`verifyCss`) isn't wired into the agent's save. It needs the save to compare the stylesheet before and after. |
| M-50 | Translated pages re-translating edited words: the translation step needs new overrides. |
| M-52, M-55, M-56 | Table nobody can write to; rename leaves the old name; removing one language. Each needs its own step or tool change. |
| M-60, M-61 | No tool for the stored theme or the QR list; split parts that depend on each other. Features. |
| M-62 | The page-shows check lets go after one hold. Holding forever could trap a run, so it needs a decision on what happens instead. |
| M-72 | "Scan my site for security problems" as its own free step. A feature. |
| M-73, M-76 | Naming our own timeout vs a billing refusal; replies cut short. Partly covered by M-74; the rest is the reply writer. |
| M-86, M-91, M-92, M-94 | Low: small reply notes, long briefs, first-build questions, keeping the AI's raw answers for disputes. |

## Tests added tonight

`test/agent-gates-batch1.test.mjs` through `test/agent-gates-batch8.test.mjs`: 10 + 9 + 6 + 7 + 8 + 6 + 6 + 1 = **53 new tests**.
- Each batch's tests fail on the code before that batch. Batches 1–4 were red-checked against it; batches 5–8 fail on it by import or landmark.
- About 25 older tests were updated, each where it encoded the old behaviour. The reason is written beside each change in the test.
