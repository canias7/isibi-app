# 2026-10-12 — Round 18: the whole fact check on the asked section, stored and served

**The review**: Codex reviewed `2015cc0c` (round 17 and its records). 206
focused tests passed and three browser-dependent tests were skipped; CI was
green. One control still passed when it should fail. The round-17 fixes, the
trace attribution and the product code are kept unchanged.

**Commits**:
- `d9434979`: the fix and its tests;
- the commit carrying these records.

**Scope**: `scripts/canary-requests.mjs` and
`test/acceptance-addon-free.test.mjs` only. No product file, container input,
billing or flag changed; the predicted image stays `1e30b6fb56b51794`. No paid
call, fal call, merge, deploy or container build.

## 1. The control

A section stored with "£25 a head, cheese included" and served with "The
price is £50 a head." added passed every outcome check; the £25-only control
passed too. The served page was checked with `{ facts }` alone, so its
`only` and `denies` were dropped, and it was read whole, so its older words
were mixed with the press's.

## 2. The fix: one reader, one check, both outputs

`servedLines`, `sourceLines`, `addedRuns`, `runText`, `usesPart` and
`sectionChecks` in `scripts/canary-requests.mjs`.

- **The page's words in order, with their sentences.** Stored: one line per
  text node, in source order. Served: one line per block element, inside
  `<main>` only. A line with no closing punctuation ends its own sentence, so
  a heading, a question and an answer stay apart ("No reservations needed"
  cannot deny the answer below it).
- **Only what the press added.** An ordered diff (longest common
  subsequence) against the same page before, on each output. The page's older
  prices, hours and evenings never count for or against the section.
- **The added sections.** Contiguous added lines form one section. A
  component file the press added counts only where the page uses it (its
  import path, or one of its exported names as a tag).
- **The check, the same on both outputs.** Exactly one added section must
  state the asked facts, so another section cannot supply a missing one. That
  section is judged on every fact, amount, day, time of day and denied claim.
  Every other added section is judged on amounts, days, times and denied
  claims, so a contradiction anywhere the press added fails.
- **Stated and denied.** A claim sentence that names a fact's wording and
  denies it contradicts the fact, wherever the affirming sentence is ("… and
  Redland. We don't deliver to Redland.").
- **New pages.** The served page is read through the same line reader. The
  stored page is now judged too, inside its own `<main>`, so the frame's
  menu labels are not taken for its words. With no `<main>` the stored page
  is recorded as unverified, never passed.

## 3. Tests

`test/acceptance-addon-free.test.mjs`, now 22 cases (6 new):

| Case | What it shows |
|---|---|
| Codex's control | stored £25, served £25 plus "The price is £50 a head.": the served section fails on the amount, the stored one passes; the reverse disagreement fails on the stored side; £25 on both passes |
| Surrounding content | older vouchers at £50, opening days and evenings, and an older "gluten-free" line elsewhere on the page never count against the asked section |
| Multiple sections | a fact split across two added sections fails; another added section at £50, or claiming gluten-free, fails; an unrelated added section passes |
| Components | a component the page uses supplies the section; one it does not use cannot |
| Days, times, places and no | a served Thursday, a served evening, and a served gluten-free claim fail on the served side only; a place stated and denied fails on the stored and served page; a page with Redland missing only when served fails on the served side |
| Context and scope | a heading with no full stop stays its own sentence; a footer offer outside `<main>` never counts; a served page with no earlier reading is never judged as all new; a new page's served-only Saturday fails |

Three round-17 assertions were widened to the new check names. They still
assert the same failure: a refusal, a denied flour, and a served page that
says otherwise.

## 4. Verification

- **Red check** (the file over `2015cc0c`'s scripts): **5 of 22 fail** there.
  The surrounding-content case passes on both, as a false-failure control
  should.
- **Mutation sweep** (`sweep23`, 3 test files, every anchor checked to occur
  once): 14 mutants and a comment-only control.
  - The first pass killed 9. Five survived:
    - one is equivalent: reading the first of several stating sections only
      adds failures to a verdict that already fails;
    - four were untested paths (sentence ends, no served before-read, text
      outside `<main>`, a new page's served contradictions). A case was added
      for each, and all four were then killed.
  - **13 of 14 killed, 1 equivalent**, the control surviving.
- **Focused files**: 218 / 218 across the 12 acceptance and canary test files.
- **Full suite** `10663 / 10663 / 0 / 0` (+6).
- **Consolidated acceptance sweep** 41 files, **537 / 537** (independent work
  137, dependencies 92, clarification and resume 201, partial failure 107).
- **Required CI**: unit tests 38236080782 `success` on `d9434979` (10663 tests,
  10622 passed, 0 failed, 41 skipped).

## 5. What remains

- **Contiguous sections only.** Two sections the press added side by side,
  with nothing unchanged between them, read as one. A fact can then come from
  either, and a contradiction in either still fails.
- **A component is "used" by its import path or exported name.** A component
  rendered some other way (a dynamic import, a re-export) would not count,
  and its words could not supply the section; it fails, never passes.
- **Equivalent wording is a per-fact list**, and contradictions are checked
  for amounts, days and times of day. An extra place is not refused; a denied
  place is.
- **Line splitting is per text node and block element.** A sentence split
  across inline elements stays one line; two sentences in one text node are
  split on their punctuation.
- **New pages without a `<main>`** are judged on the served page only, and
  recorded as unverified on the stored side.
- From round 17: attribution needs the job alone on the site while its trace
  ran.
