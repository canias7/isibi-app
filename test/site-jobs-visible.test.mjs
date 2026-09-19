// Can the owner tell what their scheduled work actually did?
//
// `runJob` has always computed an honest four-way outcome and every caller threw
// it into a Cloudflare log, which is not a surface a small business has. So from
// the owner's side "sent 14 reminders", "the SQL is broken", "you never pasted a
// mail key" and "nothing was due" were ONE SILENCE — and for a reminder that is
// the worst failure shape there is, because the customer does not know they were
// meant to get one either. The only symptom is a no-show months later that looks
// like ordinary business.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { jobOutcome, MAX_MESSAGES_PER_RUN } from "../site-jobs.mjs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

test("THE FOUR OUTCOMES DO NOT READ ALIKE — the whole requirement", () => {
  const cases = {
    nothingDue: { ok: true, sent: 0, dropped: 0 },
    fnBroken: { ok: true, sent: 0, reason: "returned nothing" },
    noKey: { ok: true, sent: 0, reason: "no provider key in Secrets" },
    sent: { ok: true, sent: 12 },
    threw: { ok: false, reason: "threw", error: "relation bookings does not exist" },
    // A lost overlap claim. The runner never stores this one (the winner's
    // outcome is the record), but if it is ever shown it must read as the
    // system working — not as a failure, and not as a quiet Tuesday.
    skipped: { ok: true, skipped: true },
  };
  const said = Object.fromEntries(Object.entries(cases).map(([k, v]) => [k, jobOutcome(v)]));
  const all = Object.values(said);
  assert.equal(new Set(all).size, all.length, "two outcomes produce the same sentence: " + all.join(" | "));
  for (const [k, v] of Object.entries(said)) assert.ok(v && v.length > 8, k + " said almost nothing: " + v);
  assert.equal(/Failed|Couldn’t run|Nothing to send/.test(said.skipped), false,
    "a lost claim reads as a failure or a quiet day: " + said.skipped);
});

test("a broken function is NOT reported as a quiet Tuesday", () => {
  // The distinction that matters most. `returned nothing` means the model's SQL
  // gave back null or a shape that is not a list — broken on every run — while
  // an empty list is a genuine "nobody is due today".
  const quiet = jobOutcome({ ok: true, sent: 0, dropped: 0 });
  const broken = jobOutcome({ ok: true, sent: 0, reason: "returned nothing" });
  assert.match(quiet, /Nothing to send/);
  assert.match(broken, /didn’t return a list/);
  assert.notEqual(quiet, broken);
  // …and both spellings of broken say the same thing, since the customer does
  // not care whether it was null or an object.
  assert.equal(broken, jobOutcome({ ok: true, sent: 0, reason: "returned not a list" }));
});

test("A RUN THAT FAILED READS AS A FAILURE, not as nearly-working", () => {
  // FOUND BY MUTATION, and distinctness alone could not see it. With the
  // `ok === false` branch dead, a job that CRASHED falls through to the success
  // path and comes out as "Ready to send, but threw." — a different sentence
  // from every other outcome, so the "all five differ" check stayed green, and
  // it reads like the mail-key case: one small thing away from working. It is
  // not; the SQL is broken and nothing will ever be sent.
  for (const out of [
    { ok: false, reason: "threw", error: "relation bookings does not exist" },
    { ok: false, reason: "no function" },
  ]) {
    const s2 = jobOutcome(out);
    assert.match(s2, /^(Failed|Couldn’t run)/, "a failure does not announce itself: " + s2);
    assert.equal(/Ready to send|Nothing to send/.test(s2), false,
      "a failure reads as a working job: " + s2);
  }
  // And the reason survives, or the owner is told it broke and not how.
  assert.match(jobOutcome({ ok: false, reason: "threw", error: "relation bookings does not exist" }),
    /relation bookings does not exist/);
});

test("the mail-key gate says what to DO about it", () => {
  // A site whose owner has pasted no provider key runs the job and sends
  // nothing, by design. Reported as "nothing to send" that is indistinguishable
  // from working.
  const s = jobOutcome({ ok: true, sent: 0, reason: "no provider key in Secrets" });
  assert.match(s, /Secrets/, "the sentence does not point at the thing to fix");
  assert.match(s, /Ready to send/, "it reads as nothing being due rather than as a missing key");
});

test("a capped or partly-failed run says so", () => {
  // Reported, never silent: a job quietly capped looks like a job that worked,
  // and the hundred-and-first customer is the one with no reminder.
  const over = jobOutcome({ ok: true, sent: MAX_MESSAGES_PER_RUN, overflow: 40 });
  assert.match(over, new RegExp("40 more"), over);
  assert.match(over, new RegExp(String(MAX_MESSAGES_PER_RUN) + "-per-run"), over);
  assert.match(jobOutcome({ ok: true, sent: 9, failed: 3 }), /3 messages failed/);
  assert.match(jobOutcome({ ok: true, sent: 0, dropped: 2 }), /missing an address/);
});

test("NO RECIPIENT EVER REACHES THE SENTENCE", () => {
  // It is stored in a platform table beside every other site's. Counts and
  // reasons carry what the owner needs; a customer's address in a second place
  // is a worse problem than the one being solved. Same discipline as the audit
  // log's allow-list.
  const hostile = {
    ok: true, sent: 1, to: "mrs.patel@example.com", subject: "Tomorrow at 2",
    messages: [{ to: "mrs.patel@example.com" }], reason: "no provider key in Secrets",
  };
  const s = jobOutcome(hostile);
  for (const secret of ["patel", "example.com", "Tomorrow at 2"])
    assert.ok(!s.toLowerCase().includes(secret.toLowerCase()), "leaked: " + secret + " in " + s);
});

test("junk in cannot throw — this runs on a cron", () => {
  for (const bad of [null, undefined, 7, "sent", [], {}])
    assert.equal(typeof jobOutcome(bad), "string", "threw or answered oddly on " + JSON.stringify(bad));
});

test("IT IS RECORDED WHERE THE OWNER CAN REACH IT, after the run", () => {
  // The stamp goes FIRST and must keep going first — stamped afterwards, a job
  // that dies mid-send is due again on the next tick and mails everyone it
  // already reached. Losing this note costs a line of history; moving the stamp
  // costs somebody four copies of the same reminder.
  const at = worker.indexOf("async function runScheduledSiteJobs");
  assert.ok(at > 0, "the cron moved — retarget this");
  const block = worker.slice(at, worker.indexOf("\n}", worker.indexOf("jobOutcome(out)", at)));
  const stamp = block.indexOf("last_run");
  const note = block.indexOf("last_result");
  assert.ok(stamp > 0 && note > 0, "one of the two writes is gone");
  assert.ok(stamp < note, "the outcome is written before the stamp — that ordering re-sends reminders");
  assert.match(block, /jobOutcome\(out\)/, "the outcome is computed and discarded again");
});

// The jb handler, landmark-bounded — never a byte count. Both of these windows
// were `at + 1800` and went red the day the handler grew a POST branch: the
// gate had not moved, the declarations in front of it had (this file's
// recurring own-goal, recorded against api-auth twice already).
const jbBlock = () => {
  const at = worker.indexOf('} else if (jb) {');
  assert.ok(at > 0, "no handler");
  // To the NEXT branch, whichever it is — this was pinned to `nt` and went red
  // the day the backups branch landed between them: a landmark that names its
  // neighbour is a fact about ordering, the renumbering trap one shape over.
  const end = worker.indexOf("} else if (", at + 1);
  assert.ok(end > at, "no branch after the jb handler — rescope this");
  return worker.slice(at, end);
};

test("THE OWNER'S ROUTE EXISTS, IS DISPATCHED, AND IS OWNER-GATED", () => {
  // Three separate places, because this repo has shipped an owner route that
  // was matched and never dispatched (`dm2`, custom domains — unreachable end
  // to end while looking perfectly gated).
  assert.match(worker, /const jb = url\.pathname\.match\(/, "no matcher");
  // MEMBERSHIP, not position — these pinned `jb` as the LAST entry and went
  // red when the backups matcher joined the list after it. A pin on where a
  // name sits in a list is a fact about ordering, the renumbering trap.
  assert.match(worker, /\|\| jb\b[^)\n]*\) \{/, "the matcher is not in the dispatch condition");
  assert.match(worker, /\|\| jb\b[^)\n]*\)\[1\]\.toLowerCase\(\)/, "ownerSlug does not include it");
  const h = jbBlock();
  assert.match(h, /assertOwner\(ownerDeps, jslug, ou\.id\)/, "the handler does not check ownership");
  assert.match(h, /method !== "GET"/, "an unrecognised method must be refused, not read as the list");
  assert.match(h, /status: 503/, "an unreadable list answers as an empty one");
});

test("AN UNREADABLE LIST IS NOT AN EMPTY ONE, at both ends", () => {
  // "No scheduled jobs" reads as the feature not existing and the owner stops
  // looking — the one wrong answer here that costs something.
  const h = jbBlock();
  assert.match(h, /if \(!q\.ok\) return Response\.json\(\{ error: "unavailable" \}/);
  assert.match(h, /if \(!Array\.isArray\(jrows\)\)/, "a non-array body reads as zero jobs");
  const c = chat.indexOf("async function siteFunctions(site)");
  assert.ok(c > 0, "the panel is gone");
  // LANDMARK TO LANDMARK, not a byte count (the recorded trap; this was
  // `c + 6400` and went red on 2026-09-03 when the Run now button's handler
  // landed above the toggle's).
  const panel = chat.slice(c, chat.indexOf("async function siteFiles(", c));
  assert.match(panel, /if \(!r\.ok\)/, "the client treats a failed load as an empty schedule");
  // ⚠ RE-ANCHORED 2026-09-19: the row's markup moved out of this closure into
  // `jobRowHtml`, so the sentence is asserted where it is now composed. The
  // property is unchanged and is strictly narrower than it was — it is the
  // RECURRING job that must say "hasn't run yet", because a one-time job that
  // has not fired says something better (whether it is still coming, or whether
  // its moment went by), and "yet" would promise a run that is not coming.
  const rowFn = chat.slice(chat.indexOf("\nfunction jobRowHtml("), chat.indexOf("\n}", chat.indexOf("\nfunction jobRowHtml(")) + 2);
  assert.ok(rowFn.length > 500, "jobRowHtml is gone — the panel composes its rows somewhere else again");
  assert.match(rowFn, /Hasn\\u2019t run yet|Hasn’t run yet/,
    "a job that has never run is given an invented outcome");
  assert.match(panel, /jobRowHtml\(j, j\.lastRun \?/, "the panel does not compose its rows through jobRowHtml");
});

test("THE OFF SWITCH: POST {name, enabled} exists, refuses junk, and cannot lie", () => {
  // The audit's finding was not that the toggle was missing a nicety — it was
  // that NO path in the product could stop a scheduled job: _meta.jobs is a
  // union-merge nothing removes an entry from, the rules lane's CLEARABLE is
  // exactly confirm/sms, and nothing anywhere wrote enabled:false. The runner
  // has filtered `enabled=is.true` all along; this is the write that flag was
  // waiting for.
  const h = jbBlock();
  // A REAL BOOLEAN, nothing merely truthy — `enabled: "false"` would switch a
  // job ON while the owner was switching it off (the normalizeRole lesson, on
  // the field that sends mail).
  assert.match(h, /typeof \(jbody && jbody\.enabled\) !== "boolean"/, "enabled is accepted truthy");
  // Owner-scoped AND schedule-scoped: slug alone crosses tenants the day a
  // freed slug is re-claimed, and a row with no schedule is not a job.
  assert.match(h, /site_functions\?owner_id=eq\.[^`]*&name=eq\.[^`]*&schedule_minutes=not\.is\.null/,
    "the toggle's filter lost a scope");
  // Zero rows matched must be a 404, not an ok — a toggle that reports success
  // while switching nothing is this file's most-recorded failure, on the one
  // control whose whole point is stopping mail.
  assert.match(h, /Prefer: "return=representation"/, "the PATCH cannot see whether it matched anything");
  assert.match(h, /if \(!Array\.isArray\(wr\) \|\| !wr\.length\) return Response\.json\(\{ error: "no such job" \}, \{ status: 404 \}\)/,
    "a name matching nothing reports success");

  // And the client half: the badge IS the button, it posts the OPPOSITE of the
  // server's last answer, and it repaints by reloading rather than optimism.
  const c = chat.indexOf("async function siteFunctions(site)");
  // LANDMARK TO LANDMARK, not a byte count (the recorded trap; this was
  // `c + 6400` and went red on 2026-09-03 when the Run now button's handler
  // landed above the toggle's).
  const panel = chat.slice(c, chat.indexOf("async function siteFiles(", c));
  // ⚠ RE-ANCHORED 2026-09-19 for the same reason: the BUTTON is drawn by
  // `jobRowHtml` and the HANDLER is wired in the panel, so each half is
  // asserted where it lives. Splitting them is what the assertions below
  // already do for the POST and the repaint.
  const rowSrc = chat.slice(chat.indexOf("\nfunction jobRowHtml("), chat.indexOf("\n}", chat.indexOf("\nfunction jobRowHtml(")) + 2);
  assert.match(rowSrc, /fn-tgl/, "the switch is gone from the row");
  assert.match(panel, /method: 'POST'[^}]*\/jobs'|\/jobs',\s*\{ method: 'POST'/, "nothing posts to the jobs route");
  assert.match(panel, /JSON\.stringify\(\{ name: b\.dataset\.job, enabled: next \}\)/, "the toggle does not send name+enabled");
  // The OPPOSITE of the server's last answer. A spelling pin, deliberately:
  // an inversion here is pure semantics a derived read cannot hold, and the
  // render harness that drives the click is not in `npm test`.
  assert.match(panel, /const next = b\.dataset\.on !== '1';/, "the toggle sends the state it already has");
  assert.match(panel, /if \(!r\.ok\)[^\n]*sbToast/, "a refused toggle is silent");
  // The RELOAD after a successful toggle — anchored on `return; }` so the
  // panel's own initial `load();` (inside this same window) cannot satisfy it.
  assert.match(panel, /return; \}\s*\n\s*load\(\);/, "the panel does not repaint from the server's answer");
  // And the two states carry the dataset the handler reads.
  assert.match(rowSrc, /fn-tgl fn-off" data-job="[^"]*" data-on=""/, "the paused state lost its dataset");
  assert.match(rowSrc, /fn-tgl" data-job="[^"]*" data-on="1"/, "the running state lost its dataset");
});

test("THE PANEL IS REACHABLE — the card is not forced Off", () => {
  // `versions` sat in DEAD_PANELS for four days after its route shipped, live on
  // the server and unreachable in the product. The comment above that list says
  // to flip a name out the moment its route exists; this is that.
  assert.equal(/functions:\s*'/.test(chat), false, "the jobs card is still in DEAD_PANELS");
  assert.match(chat, /'Scheduled jobs'/, "the card was not renamed off the deleted verb runner");
  assert.match(chat, /'\/api\/site\/' \+ encodeURIComponent\(slug\) \+ '\/jobs'/, "the panel calls the wrong route");
  // And nothing describes the eight-verb runner any more.
  const c = chat.indexOf("async function siteFunctions(site)");
  const panel = chat.slice(c, c + 4200);
  for (const gone of ["spec.steps", "stepLabel", "fn-hook-url"])
    assert.equal(panel.includes(gone), false, panel.slice(0, 0) + gone + " is a relic of the deleted runner");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE PANEL'S OWN CLICK, DRIVEN — because every guard above this line reads the
// markup, the CSS or the endpoint, and none of them binds a handler.
//
// ⚠ WHAT THAT COST, MEASURED: Run now is drawn `class="fn-tgl fn-run"` —
// `fn-tgl` is its LOOK (`.fn-tgl.fn-run` in the sheet) — and `siteFunctions`
// bound `.fn-run` first and `.fn-tgl` second, so the second assignment
// overwrote the first on the one button that carries both. Clicking Run now ran
// the pause/resume handler, which reads `b.dataset.job`; the Run now button
// carries `data-run`, so that is `undefined`, `JSON.stringify` drops the key,
// and the request that went out was `{"enabled":true}` — no name, no run.
// **Live since Run now shipped on 2026-09-03**, through `31fe5b61` and
// `origin/main` alike, with every assertion about this button green the whole
// time. A class is a LOOK and a dataset is a CONTRACT; the handlers bind on the
// dataset each one reads.

/**
 * The page's own script list, derived from `index.html`.
 *
 * `chat.js` is a CLASSIC SCRIPT that reads names its siblings define, so a
 * hand-kept list here would go stale the first time the page gains one —
 * silently, as a "not defined" that reads like a broken test. `auth.js` is
 * replaced by a stub because nothing here is about who is signed in.
 */
const PANEL_SCRIPTS = [...fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8")
  .matchAll(/<script src="\/([a-z0-9/.-]+\.js)"><\/script>/g)].map((m) => m[1]);

/**
 * A DOM small enough to read and real enough to BIND.
 *
 * **THE BUTTONS ARE PARSED OUT OF THE MARKUP THE PRODUCT REALLY DREW**, which
 * is the only thing that makes these cases mean anything: `jobRowHtml` answers
 * a STRING and `siteFunctions` binds ELEMENTS, so without a parse in between
 * the two halves never meet and a case would be asserting that a fixture it
 * typed itself round-trips. A class the row stops drawing disappears here too.
 *
 * It is deliberately FLAT — every button lands as a direct child of whatever
 * had `innerHTML` written to it, rather than inside the `.fn-item` wrapper.
 * `querySelectorAll` is a DESCENDANT search in a browser, so for every selector
 * this panel uses the two models answer identically.
 */
function panelDom() {
  const byId = new Map();
  const mk = (tag) => {
    const kids = [];
    return {
      tag, id: "", className: "", title: "", value: "", textContent: "",
      disabled: false, dataset: {}, style: {}, children: kids, onclick: null,
      classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
      appendChild(c) { kids.push(c); if (c.id) byId.set(c.id, c); return c; },
      removeChild() {}, remove() {}, addEventListener() {}, removeEventListener() {},
      focus() {}, blur() {},
      // A REAL PRESS: whatever handler the panel assigned, called the way a
      // browser calls it. A button nothing bound answers `null` and does
      // nothing, which is a real outcome and not a skipped case.
      click() { return this.onclick ? this.onclick({ target: this }) : null; },
      setAttribute(k, v) { if (k === "id") { this.id = String(v); byId.set(this.id, this); } },
      getAttribute: () => null,
      get innerHTML() { return this._html || ""; },
      set innerHTML(h) {
        this._html = String(h);
        kids.length = 0;
        for (const m of this._html.matchAll(/<div[^>]*\sid="([a-z0-9]+)"[^>]*>/gi)) {
          const d = mk("div"); d.id = m[1]; byId.set(d.id, d); kids.push(d);
        }
        for (const m of this._html.matchAll(/<button\b([^>]*)>/g)) {
          const tag2 = m[1];
          const b = mk("button");
          const cls = /\sclass="([^"]*)"/.exec(tag2);
          b.className = cls ? cls[1] : "";
          b.disabled = /\sdisabled(\s|$|=)/.test(tag2);
          const t = /\stitle="([^"]*)"/.exec(tag2);
          if (t) b.title = t[1];
          for (const a of tag2.matchAll(/\sdata-([a-z-]+)="([^"]*)"/g)) {
            b.dataset[a[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = a[2];
          }
          kids.push(b);
        }
      },
      querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
      // The three selector shapes this panel uses, and no more: `#id`, `.class`
      // and `[data-x]`. An unsupported one would answer `[]` and read as "the
      // panel bound nothing", so each case asserts what it found before using it.
      querySelectorAll(sel) {
        const want = String(sel).trim();
        const attr = /^\[data-([a-z-]+)\]$/.exec(want);
        const key = attr ? attr[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase()) : "";
        return kids.filter((c) => (attr
          ? Object.hasOwn(c.dataset, key)
          : want.startsWith("#") ? c.id === want.slice(1)
            : want.startsWith(".") ? String(c.className).split(/\s+/).includes(want.slice(1))
              : c.tag === want));
      },
    };
  };
  const doc = {
    // CREATE ON DEMAND, because the page's own boot reaches for ids this
    // fixture has no reason to know about; the panel's own `#fnList` is found
    // through `box.querySelector`, so nothing here can stand in for it.
    getElementById: (id) => {
      if (!byId.has(id)) { const e = mk("div"); e.id = id; byId.set(id, e); }
      return byId.get(id);
    },
    createElement: mk, querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, body: mk("body"), head: mk("head"),
    documentElement: mk("html"), title: "", activeElement: null,
  };
  return { doc };
}

/** Load the real page scripts, stub the one door to the network, and hand back the panel's buttons. */
async function openPanel(jobs, { post } = {}) {
  const { doc } = panelDom();
  const calls = [];
  const toasts = [];
  const s = {
    console: { log() {}, warn() {}, error() {} },
    document: doc,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    crypto: { randomUUID: () => "id-x" },
    location: { pathname: "/", search: "", href: "https://gofarther.dev/", origin: "https://gofarther.dev", reload() {} },
    history: { replaceState() {}, pushState() {} },
    navigator: { userAgent: "node", language: "en", clipboard: { writeText: async () => {} } },
    setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: async () => { throw new Error("no bare fetch"); },
    Auth: {
      userId: () => "acct-A", email: () => "you@example.com", accessToken: async () => "tok",
      isSignedIn: () => true, onChange() {}, signOut: async () => {},
      signOutEverywhere: async () => {}, session: () => ({ user: { id: "acct-A" } }),
    },
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    requestAnimationFrame: (f) => setTimeout(f, 0),
    URL, URLSearchParams, TextEncoder, Response, Request, Headers, AbortSignal,
    Intl, Date, Math, JSON, confirm: () => true, alert() {}, prompt: () => null,
    getComputedStyle: () => ({ getPropertyValue: () => "", width: "0px", height: "0px" }),
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    Blob, File: globalThis.File, FormData, Image: class {},
    performance, queueMicrotask, structuredClone, btoa, atob,
  };
  s.addEventListener = () => {};
  s.removeEventListener = () => {};
  s.dispatchEvent = () => true;
  s.window = s;
  s.globalThis = s;
  vm.createContext(s);
  for (const src of PANEL_SCRIPTS) {
    if (src === "auth.js") continue;
    vm.runInContext(fs.readFileSync(new URL("../public/" + src, import.meta.url), "utf8"), s, { filename: src });
  }
  // Replaced AFTER load, so the handlers under test are the real ones.
  s.apiFetch = async (path, opts = {}) => {
    const rec = { path, method: (opts && opts.method) || "GET", body: opts && opts.body ? JSON.parse(opts.body) : null };
    calls.push(rec);
    if (rec.method !== "POST") return { ok: true, status: 200, json: async () => ({ ok: true, jobs }) };
    return post ? post(rec) : { ok: true, status: 200, json: async () => ({ ok: true, result: "Ran." }) };
  };
  s.sbToast = (m) => { toasts.push(String(m)); };
  vm.runInContext(`siteFunctions({ slug: "repairbench-1" })`, s, { filename: "case.js" });
  await new Promise((r) => setTimeout(r, 20));
  const buttons = doc.getElementById("fnList").children.filter((c) => c.tag === "button");
  return {
    buttons, calls, toasts,
    posts: () => calls.filter((c) => c.method === "POST"),
    byClass: (c) => buttons.filter((b) => String(b.className).split(/\s+/).includes(c)),
  };
}

const RECURRING = {
  name: "nightly_booking_count", fn: "nightly_booking_count", everyMinutes: 1440,
  at: "23:00", tz: "Europe/London", enabled: true, lastRun: null, lastResult: null,
  on: null, onState: null,
};

test("CLICKING RUN NOW POSTS {name, run:true} — the binding, not the markup", async () => {
  const p = await openPanel([RECURRING]);
  const run = p.byClass("fn-run");
  // THE OBSERVER, PROVED ALIVE FIRST. "no wrong request went out" is a negative
  // assertion, and a fixture that drew no Run now button satisfies it perfectly.
  assert.equal(run.length, 1, "the panel drew no Run now button at all — nothing below is being tested");
  assert.equal(run[0].dataset.run, RECURRING.name, "Run now lost the job name it posts");
  // …AND IT STILL CARRIES BOTH CLASSES, which is the whole point: the fix is
  // not "stop sharing the look", it is "stop binding on the look". A row that
  // dropped `fn-tgl` would make this case pass for the wrong reason.
  assert.ok(String(run[0].className).split(/\s+/).includes("fn-tgl"),
    "Run now no longer shares the switch's look, so this case cannot see the collision it exists for");
  assert.ok(typeof run[0].onclick === "function", "Run now has no handler bound to it");

  await run[0].click();
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(p.posts().map((c) => c.body), [{ name: RECURRING.name, run: true }],
    "Run now sent something other than a run of that job — this is the reproduced defect");
  assert.deepEqual(p.posts().map((c) => c.path), ["/api/site/repairbench-1/jobs"], "Run now posted to the wrong route");
  assert.ok(p.toasts.includes("Ran."), "the sentence the run came back with was not shown");
});

test("CLICKING THE ON SWITCH STILL POSTS {name, enabled} — the control that makes the fix a fix", async () => {
  // Without this, "Run now stopped running the pause handler" is satisfied just
  // as well by a change that unbinds the pause handler from everything.
  const p = await openPanel([RECURRING], { post: () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }) });
  const tgl = p.buttons.filter((b) => Object.hasOwn(b.dataset, "job"));
  assert.equal(tgl.length, 1, "the panel drew no pause/resume switch");
  assert.ok(typeof tgl[0].onclick === "function", "the pause/resume switch has no handler bound to it");
  await tgl[0].click();
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(p.posts().map((c) => c.body), [{ name: RECURRING.name, enabled: false }],
    "the switch no longer pauses the job it names");
});

test("NO BUTTON IS BOUND TWICE — a census over every state a row can be drawn in", async () => {
  // The defect was one button matched by two selectors, and the shape that let
  // it happen is a CLASS used for binding. This asks the property directly, over
  // every row state the panel can draw, so a third button that gains both
  // datasets is a red run rather than a silent rebinding.
  const states = [
    { ...RECURRING },
    { ...RECURRING, enabled: false },
    { ...RECURRING, everyMinutes: 44640, at: "09:00", on: "2026-10-03", onState: "scheduled" },
    { ...RECURRING, everyMinutes: 44640, at: "09:00", on: "2026-10-03", onState: "missed" },
    { ...RECURRING, everyMinutes: 44640, at: "09:00", on: "2026-10-03", onState: "attempted", lastRun: "2026-10-03T08:00:05Z" },
    { ...RECURRING, everyMinutes: 44640, at: "09:00", on: "not-a-date", onState: "unreadable" },
  ];
  const p = await openPanel(states.map((j, i) => ({ ...j, name: "job_" + i })));
  assert.equal(p.buttons.length >= states.length, true, "the panel drew fewer buttons than it has rows");
  for (const b of p.buttons) {
    const both = Object.hasOwn(b.dataset, "run") && Object.hasOwn(b.dataset, "job");
    assert.equal(both, false, "a button carries both data-run and data-job, so one handler overwrites the other: " + b.className);
  }
  // And every enabled button really got a handler — the other way this can go
  // wrong is a selector that matches nothing and a panel that does nothing.
  for (const b of p.buttons.filter((x) => !x.disabled)) {
    assert.ok(typeof b.onclick === "function", "a live button was left unbound: " + b.className + " " + JSON.stringify(b.dataset));
  }
});

test("A SPENT ONE-TIME JOB'S RUN NOW IS DISABLED, CARRIES NOTHING AND SENDS NOTHING", async () => {
  // RETAINED from the one-time round: `last_run` is the claim's own etag, so a
  // consumed occurrence can never be claimed again and the press would come back
  // "Skipped". The button says why instead, and this asserts all three layers —
  // disabled, no dataset, and no request even if something presses it anyway.
  const p = await openPanel([{
    ...RECURRING, name: "remind_once", everyMinutes: 44640, at: "09:00",
    on: "2026-10-03", onState: "attempted", lastRun: "2026-10-03T08:00:05Z", lastResult: "Sent 1.",
  }]);
  const run = p.byClass("fn-run");
  assert.equal(run.length, 1, "the row drew no Run now button");
  assert.equal(run[0].disabled, true, "a spent one-time job still offers a live Run now");
  assert.equal(Object.hasOwn(run[0].dataset, "run"), false, "a spent Run now still carries the job to run");
  assert.match(run[0].title, /Already used its one run/, "the button does not say why it is dead");
  await run[0].click();
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(p.posts(), [], "pressing a spent Run now sent a request");
});
