# 2026-10-26 — reply-seen: a read page is not "unread", a wordless addition is not unseen

**Live case**: driftwood-and-daughters-5, router-split test (job `d7b45bac`).
The add-on put a hidden spam field (component `honeypot`, no words) on `/hire`;
the render check was cut short (`partial: true`). Every need was told
`in-code`: "I've added something for this to the page's code, but I couldn't
read the built page to see it".

**Causes** (`builder/content-evidence.mjs`):
1. `judged()` returned `shown: "unread"` when ANY added text was unsure, even
   when others were seen on the page.
2. An addition with no words of its own (`componentOnRoute` with no texts,
   `routeEvidence` with tags only) was given `shown: "unread"`.

**Fix**:
1. With some texts seen and the rest unsure → `"some"` (told `behind`);
   `"unread"` only when nothing was seen.
2. A new reading `"wordless"` for additions with no words: told `set-up`
   ("I've set that up, but I can't confirm…"), never "couldn't read the built
   page". Accepted by `readContent`; ranked above `all` so it never hides a
   weaker reading of a sibling route.

**Left as is**: the job's need "a visitor can request a board…" was judged
covered by the honeypot addition while the form already existed on `/hire`
from an earlier run; saying "the form was already there" needs the judge to
name the existing page as a carrier, which it did not. Not changed here.

**Tests**: `test/content-evidence.test.mjs` — (d) and (f) and CE 15 revised,
one new case; red on main's code (2 fail). Full suite 12,876: 12,873 pass, 1 fail (site-secrets key, fails on main too), 2 skipped. Sweep 7/7 killed, the
comment-only control survived.
