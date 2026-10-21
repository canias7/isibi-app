# Security scan for customers' sites: the plan (2026-10-21, for the owner's approval)

The owner (2026-10-19): *"save it for later to audit the sites the builder does,
not my platform"*, about Cloudflare's security-audit skill
(`github.com/cloudflare/security-audit-skill`, MIT). On 2026-10-21: *"lets plan
it out"*.

The target is a **customer's generated site**: its pages, forms, logins, data
rules, payments and outside connections. Not Go Farther itself.

## What the customer gets

- **More → Security → Run scan.** The card exists today and is switched off
  ("Not available yet"). Asking in the chat ("is my CRM secure?") starts the same
  scan, once the router knows the request.
- The scan runs in the background, like an edit job: progress lines in the chat,
  "Working…", and the stop button.
- A plain-English report in the Security panel. Each problem shows what it is,
  why it matters for this business, how sure we are, and a **Fix it** button.
  Fix it goes through the normal edit path at the normal edit price.
- A history of scans, so "fixed since last time" is visible.

## How it works: Cloudflare's method, run our way

The skill is written for a general coding agent auditing any codebase. Every
site we build has the same shape (the kit, the data hooks, the rules step, the
site worker, payments through the owner's own key). So we take the skill's
**method and its attack lists** (MIT) and run them as our own pipeline, tuned to
that shape:

1. **Map the site (no model, free).** Read what we already store: the pages,
   the site worker, the tables with their access rules (`resolveAccess`), the
   forms, payments, outside connections and the published head.
2. **Fixed checks (no model, free, always right).** Questions a program can
   answer outright:
   - a table holding private data that anyone can read;
   - a form that saves entries with no spam protection;
   - a secret key showing in the page;
   - a page that should need a login but doesn't check for one;
   - a payment amount set by the visitor's browser;
   - a site worker that fetches any address a visitor gives it.
3. **The model hunts (paid).** The site's code goes to the model with the
   skill's relevant attack lists (browser-side, logins and web requests, data
   isolation, and AI if the site uses it). Each part of the site is looked at
   separately, so nothing is skimmed. The result is candidate problems.
4. **Every candidate is challenged (paid).** A fresh model call, which never
   saw the hunt, tries to prove each candidate is *not* real. This is the
   skill's central rule: the checker is never the finder. What survives is
   **confirmed**; what can't be settled is **needs checking**; the rest is
   dropped.
5. **Report.** Results are stored in the skill's own `findings.json` format and
   drawn in the panel. Only confirmed problems get a severity.

**Where it runs:** in the site's own container, as a queued job. That gives the
same recovery, lease and 50-minute deadline as edits. **The site's code is only
read, never executed.** The skill asks for a locked-down sandbox before running
target code; without one, a lead stays "needs checking" rather than being proven
by running it. Running code is a later step, if ever.

**Where results live:** `security/<slug>/<run>.json` on the server, so every
device sees them. The site delete removes them with everything else.

## Phases

Each phase ends with screenshots, tests, records, and a merge only on the
owner's word.

- **A — fixed checks only (no model, no cost).** Steps 1, 2 and 5. The card goes
  live as "Quick check", free. It is useful on its own and proves the panel,
  storage and report.
- **B — the model hunt and the challenge (paid).** Steps 3 and 4. First a
  measured run on one test site, approved in advance, to put a real number on
  the cost. Then it is priced like everything else ("charge every token").
- **C — Fix it.** Each confirmed finding becomes an edit request with its own
  words.
- **D — from the chat.** The router recognises "check my security" and starts the
  scan.
- **Later, not planned now:** a scan after every build; running the site's code
  in a locked sandbox to prove a finding; scanning the platform itself.

## Decisions that are the owner's

1. **When it runs:** on demand only (recommended to start), or also after each
   build.
2. **Price:** free for phase A; phase B priced from the measured run (a rough
   guess before measuring: 10–40 credits a scan for a normal site).
3. **Which model** does the hunt and the checking: the builder's (Grok) by
   default, or a stronger one for the checking step.
4. **Who sees it:** every customer, or a test group first.

## What is already in place

- Every site's code, tables, rules and settings are on the server.
- The edit path that Fix it would use.
- The queued-job system with recovery, progress lines and stop.
- The Security panel and its switched-off card (`moreSecurity` in `public/chat.js`).

## What it does not promise

The model finds the common, clear problems well. It can miss things. In
Cloudflare's own runs, one audit found about half of what repeated audits found
in total. The report says "no problems found", never "secure".
