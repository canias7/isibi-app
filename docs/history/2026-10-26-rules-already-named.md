# A rule that already holds is "already so", not "no rule I could change" (2026-10-26)

**Live case.** Test 11 asked "only I should be able to see who signed up". Job e3cf9c24 failed with `no-match`: the rules model returned an empty list, most likely because `newsletter_signups` was already owner-only. The customer was told "There was no rule I could change."

**Fix (wording only).**
- `RULES_SYSTEM` now says: when a table already has what they asked for, still name it with the asked level. It is then recorded as already so, and an empty list is never the answer for a rule that already holds.
- The no-match retry reason says the same.
- The existing `splitAlready` path then answers `satisfied` at no cost, and the reply says "Already so on …".

**Checks.**
- `test/rules-already-named.test.mjs`, 2 cases: the system wording, and an empty first answer that is retried and comes back already-so.
- Red: both fail before the change.
- Sweep: 3 of 3 killed; the comment control survived.
- `run6-fixes`, `site-rules*`, `picked-model`: 79 of 79 pass.
