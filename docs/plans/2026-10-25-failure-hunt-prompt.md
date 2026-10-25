# Prompt for the owner's external assistant: failure hunt (2026-10-25)

Paste everything between the lines.

---

Read-only failure hunt on the Go Farther site builder: GitHub `canias7/isibi-app`,
branch `main` (commit `b12dba52c` or later). Do not change code, do not call any
paid AI model, do not write to live sites or databases. Write one report file and
**commit it on a new branch `failure-hunt-2026-10-25` and push it** (never to
`main`, no pull request).

**Goal:** find every way a customer's request can END BADLY — failed, nothing done,
partly done but reported as done, stuck, looping, or charged for nothing — and
rank them by how likely a real customer hits them.

**Read first:** `CLAUDE.md`, `docs/architecture.md`, `docs/edit-path.md`,
`docs/addon-path.md`, `docs/build-path.md`, `docs/traps.md`.

**How to hunt** (for each path below):
1. List every place the code ends a job without doing the work: `return { ok: false … }`,
   `aFailure(…)`, refusals, `no-add`, `refused`, `unchanged`, thrown errors caught and
   swallowed, timeouts, "cannot", empty model answers.
2. For each: what customer message gets there? Is there a retry (owner rule: never fail
   completely without at least one retry, with the reason, same model, same effort)?
   Is the work handed to another step that can do it? What does the customer see, and is
   it true? Is anything charged?
3. Look for loops (a part handing work back and forth), parts waiting forever on a part
   that failed, and later parts running on top of a failed earlier part.

**Paths:** first build (design, pages, sections, header/footer, database, compile,
render check, publish); every edit step (text, data, rules, look lanes, picture, logo,
nav, page, frame); add-ons (picker, designers, requirement judge, row/table/component/
words writers); multi-part requests (split, defer, wait, resume after a question);
publish / restore / discard; the container job runner (leases, deadline, parked jobs,
provider waits).

**Already being fixed — skip these:** existing pages routed to the add-on step; whole
features (e.g. bookings) on an existing page; header/footer edit refusals; several page
edits started in parallel for one message; Stop and the task panel; the shadow diagnosis
treating a customer Stop as a failure.

**Output** (`docs/audits/2026-10-25-failure-hunt.md`): a table — path · file:line ·
customer message that triggers it · what happens · retry? · customer sees · charged? ·
smallest general fix (no keyword rules) · likelihood (high/medium/low). Then the top 15
by likelihood. Mark anything you could not confirm in the code as **unverified**. Cite
file and line for every claim.

---

## Notes for Claude (not part of the prompt)

- Verify every finding against the code before fixing; it's model output.
