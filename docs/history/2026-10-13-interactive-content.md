# Content inside collapsed or interactive sections: stored, shown, unverified (2026-10-13)

Fix commit `a4e0da19`. Offline only, and nothing was spent, merged, deployed or built. **Run 144 stays closed**, and no paid test or opt-in was opened. The Build
flags, the page and component limits, the task-isolation guards and
correction reuse are all untouched.

## 1. The recurring problem

The Add-on told the customer "I can't see from here whether …" about a
section it had built. This happened in runs 135, 137, 141 and 144, each about
a questions section that was stored and served.

**The evidence** (run 144's artifact 11827086078, downloaded through the
signed link the GitHub connector returns; sha256 `3b87cd7c…` matches the
run's own):
- the job's answer read `requirementsTold: [{ told: "unseen", state: "unknown" }]`;
- the stored `/bake-list` holds both sentences, through `<Faq items=…>`;
- the page as served has 9 accordion items, all `data-state="closed"`. It
  carries "Can I leave the list?", but not "Yes, reply STOP to any note."
  (served 0; with every question opened, 1).

## 2. The shared cause, traced

1. The Add-on's judgment names the carrier of a section as
   `component:<name>` (`judgeItems`).
2. `component` is in `OPAQUE_KINDS`: nothing gives a component an identity.
   So `carriersReading` answered `unknown` for it on every path:
   - `appliedFacts` never lists a component;
   - `aShipped` holds routes only;
   - the coverage was recomputed after the pages shipped, but with nothing
     new to read.
3. `requirementReport` turned `unknown` into `told: "unseen"`.
4. The reply's facts (`TOLD_FACTS.unseen`) became the not-done fact "Nothing
   here can see whether this is in place".
5. No rendered text was available anywhere on the path. The container's
   render check kept only 40 landmarks (40-character text), and nothing read
   the page's text.

This is not about questions sections, this bakery or these words. Any
component a change adds read `unknown`, whether it is collapsed, shown on
load, or missing.

## 3. The fix: three facts, kept apart

**`builder/content-evidence.mjs`** (new; no imports; the parser is
injected, as the menu and picture readers do):

| Function | What it does |
|---|---|
| `visibleTexts` | Reads the texts a visitor could read in a file, from the TypeScript syntax tree, each with a placement: `conditional` (a condition's arm, a `&&`, or one of several returns, i.e. one of the page's alternative views), `handed` (passed in a prop, an array or a callback to a part that decides when to show it), or `direct`. Technical strings (class names, paths, keys, imports) are left out. With no parser, or a file that does not parse, it answers `null`. |
| `addedByRoute` | Compares stored files before and after, per route (`routedSources`). The result is the texts this change added and the components it added by name. A part a page newly renders brings its text. A file that did not parse, or a route reached only maybe, is `read: false`. With no parser it answers `null`. |
| `renderedTexts` | Reads the render check's new `texts` strictly. |
| `routeEvidence`, `componentEvidence` | Give each designed component one reading: `stored` is added, none or unread; `shown` is all, some, none or unread; `hidden` lists the texts the first load did not show, with their placements. A text found on the page counts as shown. A text not found counts as hidden only on a complete read. A new component with no words of its own is added, with its content unread. |

**The render check** (`builder/render-check.mjs`, `builder/site-render.mjs`):
- On desktop, before anything is clicked, it reads each route's
  `body.innerText` (`textProbe`), capped at 12,000 characters, with
  `complete` false when the cap cut it.
- The text rides on the report as `texts`. It is not a finding and is never
  told as text.
- `body.innerText` leaves out closed, hidden or undrawn content.

**`builder/site-requirements.mjs`** (still import-free; `readContent` lives
here):
- `carriersReading` reads a `component` carrier from that evidence:
  - stored `added` is found, applied, and carries its content reading;
  - stored `none` is absent, so the requirement is `missing`;
  - anything else is `unknown`, as before.
- `requirementOutcomes`, `requirementReport` and `requirementRecord` take
  `content`.
- A found component's outcome stays `unverified`: present is not exercised.
  It carries `content`.
- Three new told states, all of them "set up" with their evidence:

  | Told | Meaning |
  |---|---|
  | `shown` | Seen on the published page as it first loads. |
  | `behind` | In the code, and not shown on first load. The hidden words are attached with their placements. |
  | `in-code` | In the code, but the published page could not be read. |

- Each has its own sentence in `toldNote`. None claims that anything a
  visitor does works.

**`builder/site-reply.mjs`** (the reply model's facts):
- three new `note` facts:
  - **shown:** "Added, and seen on the published page as it first loads
    (nothing a visitor might do with it was tried)."
  - **behind:** "Added to the page's code, and not shown when the published
    page first loads: it sits [where] … Nothing here opened, switched or
    sent anything, so whether it appears when a visitor does is not
    checked", plus the words the first load did not show;
  - **in-code:** "… the published page could not be read, so whether it
    shows is not known."
- The entries are read strictly: hidden words only beside `behind`, and
  placements only from the known set. Anything else falls back to the whole
  note.
- `toldAs` treats the three as "set up" under a failure that applied
  nothing.
- **The reply stays model-written** from these facts.

**`worker.js`** (the Add-on route):
- `aAfterCompile` keeps the build's `texts`, or the repaired build's when a
  repair recompiled.
- Just before the last record write (after `aShipped`), `aContent` is
  computed. It uses the stored pages and parts before the change, the
  shipped pages (the repaired ones when there was a repair), the parser and
  the texts.
- The stored record and the reply both hear it.
- A failure exit passes `content: null`, so it reads exactly as before.

## 4. Tests (`test/content-evidence.test.mjs`, 12 cases)

| Case | What it checks |
|---|---|
| **CE 1** | The reader: texts and placements; technical strings left out; no parser, or a broken file, is `null`. |
| **CE 2** | Before against after, per route, with repeats counted. |
| **CE 3** | **Initially collapsed** (run 144's shape). The outcome is `behind`, state `unverified`, with the hidden answer attached. The note says it doesn't show on first load and nothing was tried. The reply model's fact says exactly that, with the words, and "Nothing here can see whether" is gone. |
| **CE 4** | **Shown on load.** The outcome is `shown`, and the fact still makes no claim about interaction. Text folding (curly quotes, dashes, spacing) is covered. |
| **CE 5** | **Mutually exclusive views.** A sentence only in the sent view is `behind`, placed in an alternative view, and no disclosure is named. A copy in both views counts as shown. |
| **CE 6** | **Genuinely missing.** The page is unchanged, or changed only in a class name: `still-to-do`, state `missing`, a not-done fact. |
| **CE 7** | **Incomplete or failed reads:** no parser, a broken file, a route never reached, a read the cap cut, a part reached only maybe, a new component with no words of its own, no evidence at all, and a malformed reading. Each is `unseen` or `in-code`, never present or absent. |
| **CE 8** | A part a page newly renders brings its text; a route it already reached gets nothing. |
| **CE 9** | The facts read strictly; `toldAs` under a failure. |
| **CE 10** | `textProbe`'s folding and cap; `renderReport` carries `texts` only when there are some; `renderedTexts` reads strictly. |
| **CE 11** | **Through the real Add-on route**, with supplied model answers and a supplied render report: a collapsed section reaches `requirementsTold`, `coverNote`, the stored record and the reply model's facts as `behind`. |
| **CE 12** | **Through the route:** `shown`; a page left without the section is `still-to-do`, with its not-done fact; a route the browser never reached is `in-code`. |

**Red checks:**
- With the component evidence switched off in `carriersReading`, CE 3–7, 11
  and 12 fail (7 of 12). The other five test the modules on their own.
- With the Worker's `content` cut from `aCoverage`, CE 11 and 12 fail.

The one existing case that pinned `TOLD` (TOLD 1) was updated, with a dated
note.

**The full suite caught one real defect.** The first full run, on
`a4e0da19`, was `10752 / 10751 / 1 / 0`. `dockerfile.test.mjs` found that
the new module was not in the container's worker tree, so every job would
have died at import. That was fixed in `88dec2a0` (the Dockerfile copy
line).

**Mutation sweep** (21 mutants, against `content-evidence` and
`requirement-told`):
- 16 of 19 were killed at first.
- Two of the survivors were real test gaps, closed in `edfabc3e`:
  - CE 11 had read the stored record only conditionally;
  - CE 7b now covers a component on two routes with content on only one,
    which is unread.
- Re-run: **18 of 19 killed**, and both comment-only controls survived.
- **The one survivor** is that the repaired build's text replaces the first
  compile's (`aRendered` after a repair). The Add-on route harness cannot
  drive a repair round (it has no stub for the repair model), so this line
  is guarded by review only.
  *Closed 2026-10-13 (`9a0c6bed`):* the choice is now the helper
  `publishedTexts`, tested by CE 13
  (`docs/history/2026-10-13-connected-cases.md` §1).

**Full suite on `edfabc3e`: `10753 / 10753 / 0 / 0` locally.**

## 5. Run 144's one console error, identified (free)

- **What it was:** "Failed to load resource: the server responded with a
  status of 422 ()", from the artifact's `ui.json`, `consoleErrors`. The
  matching request is
  `GET /api/site/edit/594ebe450933acebca91467d7e54e3f5` → 422, at 28.4 s,
  before any message was sent.
- **Where it came from:** that job is run 137's Add-on, which failed with
  `error: "rewrote"` (the stray rewrite the isolation fix later corrected).
  When the app opens, it rediscovers the site's earlier requests and re-reads
  their jobs. A finished job's final answer is served with the job's own
  stored status, here 422. The browser logs every non-2xx response as a
  console error, automatically.
- **Impact:** none on the run.
  - The app read the stored answer (`final: true`), and the read itself
    worked.
  - No retry, no charge and no visible error resulted; page errors were 0.
- **Classification:** not a product defect, so not changed. It is the job
  poll's documented contract: the answer is replayed with its original
  status, and the browser and the canary already read the status as the
  outcome.
- **What it does affect:** the canary's console-error count, which on any
  site with a failed job in its history is not a count of this run's errors.
  Backlog: count only errors after the first send, or exclude replayed final
  reads.

## 6. What is and is not shown

**Shown, offline, with supplied answers:**
- the three-way reading, and that the reply model gets it;
- the old `unseen` reading for every case where evidence is missing.

**Not shown:**
- The render check's `texts` from a real container. `textProbe` is unit
  tested only, and no build ran.
- A real model writing a reply from the new facts.
- Opening a disclosure, switching a tab or sending a form. Nothing exercises
  these, by design.
- **Limits:**
  - Text added through a computed value, an import from another module, or
    a component's own default copy is read as "added, content unread", not
    as shown.
  - Two components on one page share that page's added texts.
    *Closed 2026-10-13 (`9a0c6bed`, CE 15):* each now reads its own share
    only, or reads unread.
  - The static placement is a hint only.
- **A deploy would build a new container image**, because `worker.js` and
  the builder modules are inputs: predicted `4444d9d53d906b8d` →
  **`98c56f9b20da4403`** (206 inputs, from `88dec2a0`, with the new module
  copied; `a4e0da19` alone predicted `50a624038c9517d3` with 205). Nothing was merged
  or built.
