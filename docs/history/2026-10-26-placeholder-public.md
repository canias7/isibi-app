# The public stand-in shows no data (2026-10-26)

**Found.** https://driftwood-and-daughters-5.gofarther.app/events showed `closed_days` and `day_price`. The site was never published, so its public address serves the stand-in from `schemaPlaceholderPage`. That page listed every table, its columns and its access rule: `lesson_bookings` with `customer_email` and `customer_phone`, visible to anyone.

**Fix (owner's design).** All three voices now render only the brand (escaped) and one line on a dark radial background, with a pulsing heading:
- building and draft say "Coming soon";
- a failed build says "This site isn't ready yet.";
- `prefers-reduced-motion` stops the pulse;
- there is no logo and no "made with" line.

`PLACEHOLDER_META` stays in the head, so `clearPlaceholder` still takes the page down. A second tag, `gofarther-voice`, records the voice. `spec` is no longer read.

**The draft swap leaked too.** `draftPlaceholder` used to replace one sentence in the stored HTML, which kept the table list public. It now rewrites the page from scratch in its draft voice, taking the brand from the stored `<title>`. It also recognises a pre-change building page by the old sentence, so those pages lose their tables when their draft lands.

**Still serving the old page.** Sites that already show an old stand-in keep it until something writes that address again:
- a publish clears it;
- a new build writes the new stand-in;
- a draft landing on an old *building* page rewrites it.

An old *draft* or *failed* page is not rewritten automatically.

**Checks.**
- Tests: 2 new guards in `test/site-placeholder.test.mjs`. In every voice, a spec with tables yields no table or column names and no access words, the mark is still there, and the brand is escaped. An old building page with tables is rewritten without them.
- Updated tests: the A01-5 draft test, `frontend-build` ("Database is live" superseded), and `api-auth` (no access wording; writers counted as 3).
- Red check: 3 tests fail on the old `worker.js`.
- Sweep: 5 of 5 mutants killed; the comment control survived.
- Screenshots of the real produced HTML (desktop and phone, building and failed) are in the session scratchpad as `placeholder-*.png`.

**Full suite on `09e2dc19c` (all five changes):** 12,893 tests: 12,889 pass, 2 fail, 2 skipped. The 2 failures: `site-secrets` (fails on `main` too) and `canary-reopen-browser` REOPEN 1 (passes alone).
