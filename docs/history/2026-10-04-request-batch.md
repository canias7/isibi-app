# The request batch, pressed (2026-10-04)

The owner's presses of the request batch on `fold-lane-bakery`, in the order
of `docs/investigations/request-flow-rollout.md` (Phases D and E), each judged
by `scripts/canary-requests.mjs`: checks and replies fail a press, coverage
never does. Deploy 2181 (`f69c873c`, image `882477e1bbbe8cbe`) runs the code;
deploy 2182 set `REQUEST_FLOW` from a secret
(`docs/history/2026-10-04-deploy-2181.md` §11).

**The spend so far: 4** (the threshold of 100 is checked between presses).

## 1. `rq-canary` — run 94: passed, so the switch is live

**Run 94** (37170558577), pressed by the owner from `main` at `f69c873c`,
2026-10-04 02:16:38–02:20:42 UTC, spend `yes`, the scenario `rq-canary` on
`fold-lane-bakery`, with the deploy and image boxes filled.
- **The preflight**: `ALL FREE CHECKS PASSED` (the Worker `f69c873c…`, a
  cold container `882477e1bbbe8cbe`, the zero-cost job settled `empty` at
  cost 0); balance 137.
- **The message**, typed into the real app: *On the Visit page, change the
  heading 'Come to the bakery' to 'Come and see us'.*
- **The routing call's own answer**: `{"intent":"edit","layer":"text","cost":3}`,
  the model's own (`edit/text`), nothing held back, no file attached.
- **The request**: `03e480007a6f9a1416b6e42b813ce6cf`, taken on and ended
  `done`: one part, `0:done@text`, its job `82e2a76cfcb0d8dbc1e86bc162693c61`
  (created 02:18:04, published 02:20:08, `done` at 02:20:13; billing
  `finalized`, cost 1). **The page posted no edit of its own**: the server ran
  the part. So `REQUEST_FLOW` is live.
- **The reply**, on screen in the same tab after 153 s, the model's own:
  *✅ On the Visit page, the heading now reads "Come and see us".* The
  composer was usable again. No console or page error.
- **What landed**: one publish, `01791080294555-wsl8c9` from
  `01790923788063-bp9rcv`, the chain verified. `/visit` now reads *Come and
  see us* | *The shutters and the street* | *Order a collection so we hold a
  loaf*. The other four pages kept their headings.
- **Every check `ok`** (19 checks and 2 reply checks), among them:
  - one routing call with the words exactly;
  - nothing walled; the order kept;
  - every stored page byte for byte as it was apart from the named heading;
  - every component as it was; no page or component added or removed;
  - every page served before still `200`;
  - the description and the header logos as they were;
  - the tables as they were.
- **The money closes**: routing 3 + the job's 1 = 4, 137 → 133. Ledger rows
  356 (`route`, −3, ref `route:fold-lane-bakery:03e48000…`, the request's
  key) and 357 (`edit` `reserve`, −1, ref `82e2a76c…#1`). Read at 02:23:19
  UTC: balance 133, last row 357, no job open, no live lease.
- **Coverage**: none listed for this press, by design (it covers no
  hand-over).
- `UI MODE PASSED: 1 message sent`. The demo change stays (the owner's rule).

**Next: R1** (`rq-1-classes`), 9–24 credits. Before it: spent 4, and 4 + 24 =
28, within 100.
