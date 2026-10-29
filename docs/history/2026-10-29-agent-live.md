# 2026-10-29 — First live run of the site agent (deploy 2286): Kiln Lane

On the owner's "Go", from the app at gofarther.dev, signed in with the saved
"A" account session (balance 107 before), recorded (video kept in the
session's scratchpad, `rec/build/564d59f8….webm`, 50 MB; screenshots in
`2026-10-29-agent-live/`).

## Runtime first (free)
- Canary run 40807883968 (owner's press, 02:41 UTC): both readers
  `7363794366a3`, cold container `a1f126d49bbe9fe8`. **Deploy 2286
  runtime-confirmed.**
- `build-health.agentNet` read live: `netCut "userns"`, `asUser true`, probe
  `NET-BLOCKED ENETUNREACH`, `DNS-BLOCKED`. Commands in the real container
  have no internet.

## The build
Message: *"A small pottery studio called Kiln Lane in Bristol: weekly wheel
classes, a shop for mugs and bowls, and a contact form."* Sent 02:46:23 UTC;
done about 02:57 (10 min 45 s).
- Planned Home, Classes, Shop, Contact; artisan look; database with three
  tables (classes, products, enquiries) and starting rows.
- The agent wrote the header/footer and four pages (5, 4, 3, 2 sections),
  checked the code, compiled clean, opened the pages in a real browser.
- Saved as a draft, not published. The browser check "was cut short before it
  finished"; on the pages it reached it found nothing wrong. Photographs were
  not bought (credits too low); three placeholder frames.
- Progress talk ran throughout in plain English (one line every ~30 s).

## Money (A account, `credit_events`)
| row | ref | delta | after |
|---|---|---|---|
| 851 | `build:5cbe19cd…:deposit` | −2 | 105 |
| 852 | `build:5cbe19cd…:settle` | −11 | 94 |
| 853 | `build:5cbe19cd…:pages` | −88 | 6 |

**101 credits, against an estimate of 15–45** (the 2026-10-28 Kiln Lane build
on the older steps cost 62 in the ledger). The agent's page writing (88) is
the cost. Balance now 6.

## Not done
The approved edit ("Make the hero headline say 'Hand-thrown in Bristol' and
add opening hours to the contact page") was **not sent**: the build already
spent more than estimated, and a balance of 6 may not cover it. Waiting on the
owner.
