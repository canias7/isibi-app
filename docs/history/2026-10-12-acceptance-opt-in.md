# 2026-10-12 — The owner's opt-in above the acceptance cap (option A)

## The decision

After deploy 2192 was runtime-confirmed (run 123) and the two free
rehearsals had run (run 125, the probe; run 126, P2), the owner chose the
acceptance plan's §5 option A: *"go with A"*. The account balance is accepted
as the bound for **P1 and P2 only**:
- P1 is the routing probe `acceptance-split-1`;
- P2 is the request press `acc-page-table`, or `acc-table-page` in its place.

B1–B3 (the image-free Add-on presses) are not included.

## What was built

The box is called `accept_balance` in the *edit canary* form, and its
description begins *ACCEPTANCE P1/P2 ONLY*. It is passed to the script as
`CANARY_ACCEPT_BALANCE`.

The script reads it with `readBalanceOptIn` in `scripts/canary-ui.mjs`, before
the sign-in:
- **Blank**: nothing changes, and the 100-credit cap stands.
- **A whole number of credits** (1–7 digits, no leading zero), beside exactly
  one of `acceptance-split-1`, `acc-page-table` or `acc-table-page`: it is
  read.
- **Anything else** refuses with exit 2 and makes no network call. That
  covers a malformed number, the box beside any other scenario or probe list,
  beside the request batch, beside none, or beside two.

The check is `optInRefusal`. It passes only when the balance read is exactly
the number named. A different balance refuses and names both numbers, as does
an unreadable balance. So does a named value that is not a whole number.

The opt-in is used in two places:
- **The routing probe**: `acceptancePreflight` takes `optIn`. With it, the
  cap's item becomes *the balance is the N you allowed this press to run
  against (in place of the cap of 100)*. The balance-read and estimate items
  stand.
- **The request press**: `runUi` takes `balanceOptIn`. It is applied at the
  first paid step, in place of `capRefusal`, and only for a scenario bound by
  `ACCEPTANCE_CAP`. In a rehearsal, the script prints whether the balance
  matches.

What is unchanged:
- Every other check: the estimate (`fundsFirst`), the deploy sha and image
  id, and P2's image switch.
- The server's own bound, which is the whole balance. The box is not a budget.

No product code changed: only `scripts/`, the workflow and tests. A merge
starts one deploy run, because a workflow changed. The container image is
expected to be reused.

## Verification

- `test/acceptance-balance-opt-in.test.mjs`, 8 cases:
  - the box's reading;
  - the check;
  - the preflight;
  - the scenarios it admits, and the wiring;
  - the real `scripts/edit-canary.mjs` under the in-process network stub:
    P1 paid at 971 with 971 named routes all 9 messages, and the same press
    blank still refuses; 972 against 971 named refuses before any route; the
    rehearsal reports MET; malformed, another scenario and the request batch
    each exit 2 with no network call;
  - the workflow's box and env line.
- `test/canary-acceptance.test.mjs`, THE OWNER'S OPT-IN: the real driver
  through the request-mode app fixture.
  - It sends at 971 with 971 named.
  - It sends nothing at 971 with 970 named, at 972 with 971 named, or when
    the balance is unreadable.
  - Without the box, it still refuses on the cap.
- The import guard in `test/canary-ui.test.mjs` names the two new imports.
- The red check: on the old scripts, the new file and the new driver case
  both fail.
- The sweep, the full suite and CI: see the owner-notes entry of the same
  date.
