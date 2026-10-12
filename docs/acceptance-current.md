# Acceptance: the instructions to follow now

*Current instructions only. They are replaced, never appended to, when they
change. The history of how they came to be, including superseded image ids,
stages and budgets, is in `docs/history/2026-10-11-acceptance-batch.md`;
nothing there is an instruction.*

**As of 2026-10-11, branch `claude/help-needed-ehlwlj`, code `ed6dbb7b`.**

## 1. State

- **Production**: deploy 2191, `main` `f96cbfd5`, image `8d6dbcea93252fbb`.
- **The branch is unmerged.** Its predicted image is **`b4fd90bc5733635b`**
  (205 inputs, predicted on `ed6dbb7b`; not built).
- **Paid acceptance is blocked.** Every paid acceptance entry point (the
  request presses, the routing-only probe batch and the image-free Build)
  refuses while the balance is above 100 (`ACCEPTANCE_CAP`). The balance is
  971, and nothing here asks for it to change. **No separate test budget
  exists.**
- **Real images are unverified**, and stay so: no test here buys one. fal is
  off limits.
- **The account's Build flags are left as they are.** Nothing is switched on
  for a test.

## 2. What is already shown, and what is not

- **Shown live** (run 119, production `f96cbfd5`, 12 credits): a prepared
  price step running inside an executing heading job, by recorded intervals.
- **Not shown live** (the branch's own work, offline only):
  1. whether the real router splits an independent page/table message into
     parts, or batches it into one answer;
  2. a scoped preparation (shown only its own page or table) replayed
     **exactly** by its job (per-job evidence `replayed ≥ 1, fresh 0`) while
     another part runs;
  3. whether a real model says `needs` when it lacks context (one sample at
     most);
  4. the image-free first Build's overlap by bands or design agents;
  5. real images;
  6. independent work inside one Add-on (its designers together; its
     photograph bought while its pages are written), and two Add-on parts on
     different pages prepared beside each other with the second replayed
     exactly (`docs/history/2026-10-11-parallel-addon.md`). Neither is in the
     proposal below: the router's choice for such a message (one Add-on or
     two parts) is unmeasured, and every case here involves a photograph,
     which no press may buy.

## 3. The minimal live proposal (not approved; nothing is pressed)

Two paid presses are necessary to verify the remaining parallel-work claims
(items 1 and 2). Everything else is optional.

| # | Press | What it proves | Estimate |
|---|---|---|---|
| P1 | routing probe `acceptance-split-1` (6 routing calls, nothing applied) | the real router's answer for each acceptance message: **batched** (one answer: not parallel work) or **parts**. It decides whether P2 can exercise parallel work at all. | 6–18 |
| P2 | `acc-page-table` on `fold-lane-bakery`, **only if P1's S3 came back as parts** | live: the price part's scoped preparation overlaps the heading job by recorded intervals, its job replays it exactly (`replayed ≥ 1, fresh 0`), and both changes land (heading; Country White 4.80 → 4.90) | 4–12 |

- **If S3 is batched**, P2 is not pressed. `acc-table-page` (S4) takes its
  place if S4 made parts, at the same estimate. If both are batched, the
  result is recorded as *the real router batches these messages; parallel
  parts are not reachable from them*, and nothing more is spent.
- **Expected total**: 10–30 credits. It is an estimate, not a limit.
- **Optional, not needed for the parallel-work claims**: `acc-needs` (item
  3, 4–14), `acc-mixed` (an add-on prepared beside a price, 17–34), and the
  image-free Build (item 4, 11–40). The Build runs only if one of `design`,
  `graph` or `bandsEveryone` is already on for the account; its free
  rehearsal says so.

## 4. The spending decision you need to make first

**What is actually enforced today**: the server's charge functions refuse
any charge the balance cannot cover. So **the only enforced bound on a paid
press is the whole account balance (971)**. No per-press or per-request cap
exists on the server. The press's own 100-credit refusal is a guard that
blocks every paid press at 971. It is not a budget.

Before anything is implemented or pressed, choose one:

- **A. Accept the account balance as the bound for P1 and P2.** Their worst
  case is the whole balance. Their expected spend is 10–30; run 119, the
  closest past press in shape, spent 12. Neither figure is a limit. Implementation: one small, reviewed change that lets these two
  presses run above 100 only with an explicit opt-in box you fill, naming
  the balance it may run against. The guard stays in place for everything
  else. No billing change.
- **B. A real separate test budget first.** A bound smaller than the
  account needs a billing change, for example a per-request cap in the
  server's charge functions or a separate funded test account with its own
  site. You asked for no billing redesign in this round, so this would be a
  separate, approved piece of work, and P1 and P2 stay blocked until it
  exists.
- **C. Do nothing live.** Paid acceptance stays blocked. Items 1 and 2 stay
  verified offline only.

**Not an option**: lowering or resetting the account's balance.

## 5. Deployment steps P1 and P2 need (after the decision; each the owner's)

1. Approve the decision in §4 and the presses in §3.
2. Review and merge whatever §4's choice needs (for A, the opt-in change).
3. **Set the repository secret `IMAGE_PURCHASES` to `off`** (needed for P2,
   not P1: every acceptance scenario refuses unless the live Worker reports
   it off; the routing-only probe never reaches an image). **This stops
   photographs for every customer while it is off, not only for the tests.**
4. **Merge the branch to `main`** (a fast-forward; one deploy run). P1 also
   needs it: a probe routes through the live Worker, so it only measures the
   router that is deployed. The image
   rolls `8d6dbcea93252fbb` → `b4fd90bc5733635b` (predicted, not built). If
   the merged commit is not `ed6dbb7b`'s code, the image is predicted again
   first.
5. Wait 15–20 minutes for the image window.
6. **The free runtime press** (*edit canary*, every paid box blank or `no`):
   it must print the new deploy sha, image `b4fd90bc5733635b` and
   `imagePurchases=false`.
7. **The free rehearsals** of P1 and P2 (spend not `yes`): each reads its
   prerequisites and reports every one a paid press would refuse on.
8. **P1**, workflow *edit canary*: *ROUTING-ONLY BATCH* = `acceptance-split-1`;
   *Run the ONE paid edit as well* = `yes`; *Refuse to spend unless the Worker
   reports this deploy sha* = the merge sha; *Refuse to spend unless a cold
   container reports this image id* = `b4fd90bc5733635b`. Every other box
   blank.
9. **P2**, only if P1 allows it: *The site to edit* = `fold-lane-bakery`;
   *RUN A NAMED SCENARIO IN A REAL BROWSER* = `acc-page-table` (or
   `acc-table-page`, as §3 says); spend `yes`; the same deploy sha and image
   boxes.
10. **Afterwards**, decide whether to set `IMAGE_PURCHASES` back to `on`
    (with a redeploy). Until then, no customer gets photographs.
