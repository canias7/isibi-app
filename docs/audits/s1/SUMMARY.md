# Audit 2, session 1 — the agent and requests (2026-11-04)

Four readers (A agent core, B agent's server side, C request engine, D requests on server and page). Their files: `A-findings.md` … `D-findings.md`. Offline, read-only, nothing spent. Checked by me before keeping: B-1/D-1 (same bug), B-3, A-1's two prompt lines. The rest as each reader graded it.

## Findings, merged (30 raised, 29 after merging B-1 and D-1)

### Re-check (2026-11-04, by me, after the owner asked)
- Confirmed with my own evidence: B-1/D-1 (a request built with a chat id drops it; the job body has no `chat`), A-1/B-2 (both instruction lines), B-3 (also: a failed server request on a new project builds, `public/chat.js:9835`), A-2 (`writableKey` accepts five names the container's `PART` rule refuses), A-3 (`syncFromRun` never calls the scope check), C-3/C-4/C-5 (the reader's probes re-run, same results).
- **Downgraded to medium**: C-1 ("start over" go-ahead) and C-2 (additions skip the line): real in code, but reached only on rare paths now that the agent takes every message.

### High (as raised: 9; after the re-check: 7)
| Id | What the customer sees |
|---|---|
| **B-1 = D-1** (checked) | Most messages reach the agent with **no conversation history**: the request path (`acceptRequest` → request record → `jobBody`) never stores or sends the chat id; tonight's page fix only covered the direct edit body. "Delete that" can still be misread. |
| **A-1 + B-2** (prompt lines checked) | A **question can build**: nothing in code separates "answer" from "change"; the prompt pushes payments toward building ("when the owner asks for a payment… write it yourself"); no price-first gate; round and credit limits are Infinity. With no history, "so can we take payments" built a 47-credit checkout. |
| **B-3** (checked) | During an AI-provider outage, a message on a **new project starts a paid first build** (11–45 credits): the server answers `intent:"build"` with `failed:true`, and the page checks `failed` only for existing sites (`public/chat.js:9819`). |
| A-2 (probe) | **Components vanish**: names the agent accepts but the shell/build refuse are wiped after any `run` command. |
| A-3 | **Shell edits skip the write limits**: page scope, one-file helpers, home-page guard, size limit. |
| C-1 | Go-ahead on "start over" **rebuilds the whole site while another request runs**. |
| C-2 | An addition via the add-on route **never waits in line**: two requests on one site. |
| C-3 (probe) | A request with a part still running is marked queued; a queued message starts beside it, and the running part shows "working" forever. |

### Medium (12)
A-4 the reply repeats the AI's own claims as facts · A-5 history is 12 messages × 600 chars, no summary, "unknown" read as "nothing said" · A-6 docs allow-list covers only 3 payment providers · A-7 balance checked every 5 rounds, a failed check counts as affordable · B-4 an answer can reach the agent without its question or original request · B-5 add-ons get no earlier answers and cannot ask · B-6 Stop does not cut an AI call in flight (up to 8 min; sync edits are charged at the end) · C-4 a part in "review" stops holding the line · C-5 a top-up before the first balance reading never resumes a credits pause · C-6 a part held on a purchase resumes outside the line · C-7 an answer not tied to a part skips the line · D-2 after 50+ messages a day, a reload/second device can miss running work, Stop and queued messages.

### Low (8)
A-8 after Stop the rest of the round's tools still run · B-7 at zero balance a question gets "out of credits for the build" · B-8 a retry bills only its second run (platform's cost) · C-8 a question expires after 24 h (owner's call) · C-9 an unknown job state leaves a part "working" forever (latent) · C-10 removing a queued part does nothing until the line clears · D-3 kept steps can show "done" above a mid-work question · D-4 one failed storage read can hold a message ~2 min.

## Not read (follow-up, session 1b)
- A: `agent-steps.mjs`, `hand-over.mjs`, `file-picker.mjs`, `input-budget.mjs`, `site-context.mjs`, `context-report.mjs`; `one-reply.mjs`'s fallback and record functions; `site-agent.mjs` ~1060–1210 (rows, settings, rules, media tools) and the helper scheduler.
- B: `site-converse.mjs`, `model-xai.mjs`, `model-fanout.mjs`, `retry-reason.mjs`, `build-models.mjs`; skimmed site map, converse context, `askReport`, web research.
- C: `settleRewrite`, `recoverHeld`, the preparation functions, `partOf`/`jobBody`, most of `requestView`/`oneReplyView`, `carveParts`, `site-dispatch.mjs`.
- D: preparation and held changes (`stage*`, `prep*`, `held*`), purchases, `enqueueSiteBuild`/`runQueuedSite*`, `designRequest`, rewrite/approve, task lines, attachments; in chat.js `initRunAgents`, `clarifyOf`, `siteReqKeys`, `siteReqKeyCard`, `siteRequestHTML`.
