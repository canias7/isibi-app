# Prompt for the owner's external coding assistant: builder audit (2026-10-24)

Prepared for the owner to paste into a separate, free coding assistant. It is
read-only and spends nothing. Paste everything between the lines.

---

You are auditing the site builder of Go Farther, in the GitHub repository
`canias7/isibi-app` (branch `main`). A customer describes a business in chat
and gets a published website; then edits it and adds features by chatting.
Your job is a **read-only audit**: do not change code, do not run anything that
calls a paid AI model or writes to a live site, and do not open pull requests.
Write your findings to one Markdown file and hand it back.

**Goal.** Find every place where the builder can fail or give the customer a
wrong result **because an AI model answered wrongly**, and every place where
our code makes such a failure worse (no retry, no check, a cap, lost work, a
misleading reply). Outages of the AI provider and genuinely impossible requests
are out of scope unless our handling of them is wrong.

**Read first** (short): `CLAUDE.md`, `docs/architecture.md`, `docs/edit-path.md`,
`docs/addon-path.md`, `docs/build-path.md`, `docs/traps.md`.

**Where the model is asked something** (audit each):
- routing a message: `builder/site-ask.mjs`, the routing route in `worker.js`;
- multi-part requests: `builder/request.mjs`, `builder/request-plan.mjs`;
- first build: design (`worker.js` design calls, `builder/design-*.mjs`,
  `builder/site-plan.mjs`), page and section writers (`builder/page-gen.mjs`,
  `builder/page-bands.mjs`), header/footer (`builder/site-frame.mjs`);
- edits, cheapest first: text, data (`builder/site-apply.mjs`), rules
  (`builder/site-rules.mjs`), look door lanes (`builder/site-lanes.mjs`),
  picture (`builder/site-picture.mjs`), logo, nav (`builder/site-nav.mjs`),
  page rung and tweak (`builder/site-tweak.mjs`, `builder/exact-edits.mjs`);
- add-ons: `builder/site-add.mjs` (picker, designers, requirement judge, writer);
- repair: `builder/compile-repair.mjs`, `builder/site-repair.mjs`,
  `builder/publish-pages.mjs`; visual review `builder/visual-review.mjs`;
- file picker `builder/file-picker.mjs`; replies `builder/site-reply.mjs`;
  progress lines `builder/site-progress.mjs`.

**For each model call, answer:**
1. What can the model answer wrongly here (wrong choice, nothing chosen,
   invalid or partial code, changing more than asked, refusing, asking
   needlessly, claiming done when not)? Give a concrete example.
2. How does our code detect it today (schema, validators, compile, render
   check, judges)? Where is detection missing?
3. What happens after detection: retry with the reason, higher effort, the
   other model (the builder supports Grok and Claude), split smaller, ask the
   customer, fall back, or fail? Is the outcome honest to the customer?
4. Is work lost, charged wrongly, or blocked downstream (other parts of the
   same request)?
5. The smallest fix, and how many failures it would plausibly remove.

**Also check** these known risk areas: caps that silently drop work; steps that
set work aside and may lose it; replies that promise or claim things the
records don't show; dependency handling between parts of one request; anything
that turns one bad piece into a whole failed change.

**Output.** One Markdown file with:
- a table: model call · file:line · failure mode · detected? · recovery today ·
  customer impact · fix · priority (critical/high/medium/low);
- the top 15 fixes ranked by how many real failures each removes;
- anything you could not verify, marked as unverified.
Be precise: cite file and line for every claim, and don't guess at behaviour
you didn't read.

---

## Notes for Claude (not part of the prompt)

- The owner asked to be reminded in 9 hours (scheduled 2026-10-24 ~05:10 UTC).
- Compare its findings with `docs/plans/2026-10-24-model-wrong-failures.md`
  (the data-driven research on branch `model-wrong-research`) before fixing.
- Check its claims against the code before acting on any; it's model output.
