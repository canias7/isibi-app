# Every component found itself; first-load absence is not a click; console errors by timing (2026-10-13)

These corrections follow Codex's review of `73772b23`. The connected batch
(`docs/history/2026-10-13-connected-cases.md`) is kept unchanged except for
one wording assertion in CC 7.

**The corrections themselves spent nothing, and nothing was merged, deployed
or built.** No paid call, image or fal call, and no container build. (The
probe list prepared in §6 was pressed afterwards as run 147, which charged
**9 credits**, balance 837 → 828: §7.) Run 144 stays closed and the paid opt-ins stay
closed. The Build flags, the page and component limits, the task-isolation
guards and correction reuse are unchanged. Main stays `fef80b9b`; production
is deploy 2201.

**Commits** on `claude/help-needed-ehlwlj`:

| Commit | What it is |
|---|---|
| `a65bb5da` | The three corrections and their tests |
| `9c4e8f9c` | The repeated-text order the sweep found |
| `93c90b9a` | AT 5 with instances that differ in source |
| `126aa05d` | The next parallel-work test's probe list (not pressed) |
| `92fcd2e0` | That list made a plain routing-only list |

## 1. Codex's false success, reproduced and fixed

**The reproduction:**
- only a booking form was requested on `/visit`;
- the page writer merely changed the heading to "Visit us this Friday";
- `componentEvidence` → `requirementReport` → the reply model's facts still
  said the booking form was added and seen.

**The cause:** the attribution guard ran only when more than one designed
component shared a route (`sharers > 1`). With one component, anything added
to its page was taken to be it.

**Now every component must be found itself** (`builder/content-evidence.mjs`),
alone, beside others or repeated:
- **Source identity, not spelling.** A tag is tied to the module it is
  imported from, through the parser's own import bindings (`importsOf`):
  - an aliased import counts (`Faq as Questions`);
  - so does a namespace member (`Kit.Faq`);
  - a same-named tag from another module does not, and neither does a tag
    no import binds, or a barrel (`@/components/ui`). These read as unknown.
  - `sourceIs` compares the module's own file name (or the namespace
    member) with the component's name.
- **Its own new instance, one per design.** At least as many new outermost
  instances of that source on the route as designs of it there, so two
  designed cards need two new cards.
- **Only its own texts.** Only the texts inside one of its new or changed
  instances count, or the texts of its own part file. A heading, a sentence
  elsewhere, or text inside an instance the page already had is not its.
- **Shown only when the copy shown can be its.** A text counts as shown
  only when the published page shows more copies of it than the route's
  files carry apart from the component's own. A heading elsewhere with the
  same words proves nothing, and that case reads as unread.
- **Uncertain stays unknown.** When the route was read whole and nothing at
  all was added, the component is absent (`still-to-do`). When something was
  added but cannot be tied to it, it is unread. That covers too few
  instances, an unresolvable import, or text with no instance, and it is
  never told as added and never as missing.

**Found by the sweep and fixed (`9c4e8f9c`):** a text the page already had,
repeated in a new card placed before the old one, used to be credited to the
old card's copy. Copies in untouched instances are now matched first.

## 2. Text missing from the first load, or passed as a prop, is not a click

**The reply model now gets observations only** (`builder/site-reply.mjs`):
- what the first load showed;
- where the text sits in the code.

**Placements are now locations**, never behaviour:

| Placement | Was | Now |
|---|---|---|
| `handed` | "shows it only when a visitor opens or chooses it" | "passed as a value to a component on the page, which decides where and when to draw it" |
| `conditional` | "for example what it shows after a form is sent" | "in code that is drawn only under a condition (one of the page's alternative views)" |

**Behaviour is its own fact**, beside every content observation (`shown`,
`behind`, `in-code`): "Not verified: whether anything a visitor does
(opening, switching, choosing or sending) shows or changes it. No such
interaction was identified or tried."

**The deterministic note** (`toldNote`, `builder/site-requirements.mjs`) no
longer says a section "waits behind something a visitor opens" or asks them
to "open it":
- for a hidden section: "it wasn't on the published page as it first
  loaded, and I haven't checked whether anything a visitor does brings it
  up";
- the shown sentence now adds: "I haven't tried anything a visitor might do
  with it".

## 3. The console line, by timing

`consoleLine` (`scripts/canary-ui.mjs`) labels errors logged before the first
send by timing only: "N logged before the first message was sent".

An error is called the app re-reading an earlier job only when the press's
own record establishes it (`historicalRead`):
- exactly one recorded response is that job's stored final answer
  (`x-gf-edit: final` on `GET /api/site/edit/<id>`);
- it was served with the status the console line names;
- it came within 2 s of the line;
- it is not one of this press's jobs (`ownJobs`).

Two candidates, another status, a non-final read, another moment, or an own
job claim nothing.

## 4. Tests

**`test/content-attribution.test.mjs`, AT 1–9.** Each refusal has a
positive control, and the cases check stored outcomes and the facts the reply
model is given:

| Case | What it checks |
|---|---|
| **AT 1** | Codex's shape: unknown, never "Added", never "seen". Control: the form written with its import is shown, with the untried fact beside it. |
| **AT 2** | The same two cases **through the real Add-on route**, with the kit's contact form. The stored record has `implementation` not `found`, no content reading and `state: unknown`, and the facts never say "Added". Control: `found`, `{ shown: "all" }`, `unverified`. |
| **AT 3** | A heading changed beside the form is not the form's text. |
| **AT 4** | Matching text elsewhere: one copy is unread, two copies are shown, and the page's own text is never the form. |
| **AT 5** | Repeated instances: one of two cards is unknown and two are added; an existing card edited is unknown; a new card beside it is added with one text. A repeated text in a new card placed before the old one (instances differing in source) is the new card's, shown only when both copies show. |
| **AT 6** | Source identity: alias and namespace count; same-named tag from another module, unbound tag and barrel do not; `sourceIs` rules. |
| **AT 7** | Nothing added at all is still `still-to-do`. |
| **AT 8** | Handed and hidden: the note and the observation name no interaction, and the untried behaviour is its own fact, once. |
| **AT 9** | The console line by timing; history only on the evidence; six negative controls. |

**Existing cases updated** (each fixture now has what a written page carries):
- **CE 5:** the sentence now sits inside the component it is attributed to,
  its own part file with two views.
- **CE 7f:** the questions component's own tag; an unrelated
  `<OpeningHours />` had been taken for it.
- **CE 11–12:** the route fixture now writes the import.
- **CE 15:** each component is imported.
- **CE 3, 4, 14 and CC 7:** the new wording, checked as two facts.

**The next parallel-work test's probe list** (`126aa05d`):
- `scripts/router-probes/addon-kinds-3.json`;
- `test/router-probes-committed.test.mjs` reads every committed probe list
  under its own name (none was checked before).

**Red check:** 10 of the 11 AT cases fail on `73772b23`, with the two new
helpers shimmed so the file loads. The one that passes there is AT 7, the
absence control, which should pass on both.

**Mutation sweep** (scratchpad `ic-sweep/`, run in a worktree):
- 13 product mutants, against `content-attribution`, `content-evidence` and
  `parallel-addon-independent`.
- **12 killed**: S1–S3, S5–S13, with S13 killed after the AT 5 case was
  given instances that differ in source.
- **1 equivalent**: S4 (text inside an untouched instance counted). After
  `9c4e8f9c`, a new text always sits inside a changed instance, so the check
  is a redundant guard.
- Both comment-only controls survived.

**Suites:**
- focused: `content-attribution`, `content-evidence` and
  `parallel-addon-independent`, 80 of 80;
- the Add-on and requirements files: 805 of 805;
- canary and acceptance: 668 of 668;
- full suite on `93c90b9a`, run with nothing touched: `10777 / 10777 / 0 /
  0`;
- **final full suite on `92fcd2e0`: `10779 / 10779 / 0 / 0`** (PROBES 1–2
  added).

**One flake, not a regression.** The run on `126aa05d` was `10779 / 10778 /
1`: **PLW 1** (`test/progress-live-writer.test.mjs`) failed at the line
written at the photo call, before any of this code runs. Re-runs:

| Code | Alone | Under load (five at once, three times) |
|---|---|---|
| New | 1 of 15 failed | 1 of 15 |
| Old (`73772b23`) | 0 of 10 | 2 of 15 |

So it is a pre-existing, load-dependent race in that test. It is recorded in
the backlog, not fixed here.

**Image:** `worker.js` is unchanged, but three builder modules changed. A
release from this branch would build **`4d38643ab08526e9`** (206 inputs, read
at `93c90b9a`), against production's `4444d9d53d906b8d`. Nothing was built.

## 5. Limits, and what is live-only

**Limits:**
- A component reached only through a barrel import, a re-export, a
  dynamically chosen tag, or one rendered by another component in a file the
  route does not list reads as unknown. That is never a false success, but
  the customer hears "can't see from here".
- Component copy that comes from a computed value or from the component's
  own defaults reads as "added, content unread".
- The foreign-copy count uses the route's own files. Text drawn by the
  layout, or by a file the route does not list, is not counted, so a match
  there could still read as shown.

**Live-only (not run):**
- the render check's first-load text from a real container;
- a real reply model writing from the split observation and behaviour facts;
- whether a real page writer imports components in the forms resolved here.

## 6. The next parallel-work test, prepared (pressed afterwards as run 147, 9 credits: §7)

**What it is for:** plan item 1, two designers running at the same time
inside one Add-on.

**Why K didn't show it:** K (run 135, closed) put a section and a line on two
pages, and the live router split it into two Add-on parts.

**The new list:** `addon-kinds-3` asks for both kinds on **one** page, three
ways:
- **K3A:** the Visit page;
- **K3B:** the Order page, "together";
- **K3C:** the Classes page, as "one block".

**The press:**
- It is a routing-only press: nothing is edited, added, built or published.
- It is a plain routing list (`92fcd2e0`), like `router-audit-1`, so the
  acceptance preflight's 100-credit cap (whose opt-in is closed) does not
  apply.
- Each message is routed once, at about 1–3 credits, so about 3–9 credits
  for the list. It needs the owner's approval and press.
- A paid `acc-addon-kinds`-style press follows only if one message comes back
  as one `addon` answer with nothing held back, and only after its words are
  read against the live page. The overlap is then read free with
  `addonDesignOverlap`.

## 7. The probe, pressed (2026-10-13)

**Run 146** (run 38459820970) refused before signing in. `addon-kinds-3`
was typed into the browser-scenario box, not the routing-only batch box.
Nothing was routed or spent.

**Run 147** (run 38460213169, 20:06–20:08 UTC, from the branch at
`ca820981`).

| Preflight | Reading |
|---|---|
| Readers | Both answered `fef80b9bc913` |
| Cold container | Image `4444d9d53d906b8d` |
| Runtime | `async`, `runner` and `imagePurchases=true` |

**All three messages came back the same:** `addon`, "batched: one answer for
every change (one step, nothing held back)". The model said `intent=addon
layer=none`.

| Probe | Page | Cost |
|---|---|---|
| K3A | Visit | 3 |
| K3B | Order | 3 |
| K3C | Classes | 3 |

**9 credits in all, balance 837 → 828.** Evidence artifact: 11844948633.

**The words, read free against the live pages afterwards:**
- **K3A (Visit) is not clean.** The page already says "We're closed on
  bank holidays.", and the asked line "We close at noon on bank holidays."
  would contradict it.
- **K3C (Classes) is not clean.** The page already says "Saturday mornings
  only", and the asked line repeats it.
- **K3B (Order) is clean.** None of its words is on the page, and the page
  has a Collection section to put the line under.

**So K3B is the only message eligible for the paid one-Add-on press.** That
press is not prepared: it needs a scenario with K3B's words, your opt-in
above the 100-credit cap, and image purchases off, as for run 144.
