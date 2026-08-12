// The edit and addon lanes, end to end, against the deployed Worker.
//
// WHY THIS EXISTS. The two cheap rungs — `edit` (four layers) and `addon` — were
// built, tested and merged with NO live coverage of any kind. Every claim about
// them came from unit tests and source reading, and this repo has recorded a
// feature dead at a silent wiring layer nine separate times, each of which
// looked fine from both ends. `build smoke` proves the BUILD path and never
// touches these routes; `member smoke` proves auth. Nothing drove the thing a
// customer actually does after their site exists: type a sentence and have the
// cheapest possible thing happen.
//
// WHAT IT COSTS, stated because everything else here is free by design. One real
// build (~25 credits) to have a site to edit, then the lanes themselves: a
// routing call is ~0.3, a data edit ~0.3, a look change ~2, an addon ~8. Call it
// ~50 credits of real spend a run. That is the price of knowing, and it is one
// fifth of what a single "just rebuild it" revise used to cost per change.
//
// IT IS ORDERED CHEAPEST-FIRST ON PURPOSE. The data layer needs no recompile at
// all, the text layer needs no model call, and the addon is the dearest — so a
// run that dies early has still proved the rungs that matter most.
//
// Needs SUPABASE_SERVICE_KEY and NEON_API_KEY. Run from CI, or locally with them
// in the environment.
import { dropUserProject } from "../../site-db.mjs";

const BASE = process.env.SMOKE_BASE_URL || "https://gofarther.dev";
const SUPABASE_URL = "https://ujrqdmmtcptvimazlhom.supabase.co";
const ANON = process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcnFkbW10Y3B0dmltYXpsaG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODUyNTUsImV4cCI6MjA5NDM2MTI1NX0.F-af9iC-BWTZN2hQ5cD1Keke8qXARhqPwxOgSHhNLK4";
const SVC = process.env.SUPABASE_SERVICE_KEY || "";
const env = { NEON_API_KEY: process.env.NEON_API_KEY };
if (!SVC) { console.error("SUPABASE_SERVICE_KEY is required"); process.exit(1); }

let passed = 0, failed = 0;
const ok = (name, cond, extra) => {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  // 900, NOT 300 — and my own widening of the look edit's detail to 900 was
  // invisible until this moved too, so the compile error stayed hidden behind
  // Vite's benign `new URL("../", import.meta.url)` warning for three runs.
  // A cap in the producer and a smaller one in the printer is two limits, and
  // only the smaller one is real.
  else { failed++; console.log(`  FAIL ${name}${extra ? "  -> " + String(extra).slice(0, 900) : ""}`); }
};
const svc = (extra) => ({ apikey: SVC, Authorization: `Bearer ${SVC}`, "content-type": "application/json", ...(extra || {}) });

/**
 * THE ONE FAILURE THAT MAKES EVERY CHECK BELOW IT MEANINGLESS.
 *
 * When the model account runs out of credit, every lane answers — a routing
 * call falls back to `addon` by design, a rule change answers 422 `send`, an
 * addon answers 503 `design`, and the check that a stranger is refused fails
 * because the rule was never applied. Measured 2026-08-12: **17 passed, 18
 * failed**, every one of the 18 descending from a single 503, and reading it
 * took a careful pass through the whole log to establish that nothing was
 * actually broken.
 *
 * `billing` is set by `upstreamKind()` only when the provider's own message
 * matches "credit balance is too low", so it is a fact rather than an inference.
 * Stopping on it is also cheaper: the run bails instead of driving six more
 * lanes against a provider that will refuse all of them.
 */
let dead = false;
const funded = (j) => {
  if (!dead && j && j.billing === true) {
    dead = true;
    console.log("\n⛔ THE MODEL ACCOUNT IS OUT OF CREDIT — stopping here.");
    console.log("   Nothing below this would prove anything, and every lane would fail for this one reason.");
    console.log("   This is also a live outage: while it lasts, no customer can build or change a site either.");
  }
  return !dead;
};

/**
 * REUSE THE SITE INSTEAD OF PAYING FOR ONE EVERY RUN.
 *
 * The build is HALF the cost of a run — ~25 credits of the ~50 — and it exists
 * only so there is something to edit. `build smoke` already proves the build
 * path on every deploy, free of this. So when the fixture site is already there,
 * this skips straight to the lanes: ~25 credits and ~2.5 minutes saved, which
 * matters most when the lanes are what is being iterated on.
 *
 * NO STORED PASSWORD ANYWHERE. The account is a fixed address and the run resets
 * its password through the admin API with the service key it already holds, so
 * nothing new has to be kept in a secret or a cache.
 *
 * SELF-HEALING, WHICH IS WHAT MAKES IT SAFE. If the fixture site is missing,
 * unreadable or not ours, it builds a fresh one at that slug and carries on —
 * so a fixture that gets into a bad state costs one ordinary run, not a red
 * check nobody can clear. `SMOKE_FRESH=1` forces the old behaviour: a throwaway
 * account, a throwaway slug, and everything torn down at the end.
 */
const FRESH = process.env.SMOKE_FRESH === "1";
const FIXTURE_SLUG = (process.env.SMOKE_SLUG || "esmoke-fixture").toLowerCase();

const stamp = Date.now().toString(36);
const email = FRESH ? `edit-smoke-${stamp}@gofarther.dev` : `edit-smoke-${FIXTURE_SLUG}@gofarther.dev`;
const password = `Es-${stamp}-${Math.random().toString(36).slice(2, 10)}`;
// A SLUG WE CHOOSE, for the reason `build smoke` already records: a slug is
// claimed by whoever built it first across every account, so letting the
// designer name the site from a fixed brief means it proposes the same good name
// every run and the second run 409s on something that is not a bug.
let slug = FRESH ? `esmoke-${stamp}-${Math.random().toString(36).slice(2, 6)}` : FIXTURE_SLUG;
/** How many builds one run will attempt before giving up on the generator. */
const ATTEMPTS = 2;
/**
 * THE NAME OF THE FIXTURE ON EACH ATTEMPT — ONE EXPRESSION, TWO READERS.
 *
 * The retry used to mutate `slug` in place, so a run whose FIRST build missed
 * left its site at `esmoke-fixture-r1` while the reuse scan below only ever
 * looked at `esmoke-fixture`. The reuse could therefore never kick in again
 * after a single unlucky generation — measured 2026-08-12, one run after the
 * reuse shipped: the fixture was live at `-r1`, the scan looked at the bare
 * slug, found the claimed-but-empty husk of the failed attempt, and paid for two
 * more builds.
 *
 * So the builder and the finder are the same function now. A name the build loop
 * can produce is a name the scan looks for, by construction rather than by two
 * lists agreeing.
 */
const slugFor = (attempt) => (attempt ? `${FIXTURE_SLUG}-r${attempt}` : FIXTURE_SLUG);
let userId = null, jwt = null, deleted = false, reused = false;

const api = (path, init) => fetch(`${BASE}${path}`, {
  ...(init || {}),
  headers: { "content-type": "application/json", Authorization: `Bearer ${jwt}`, ...((init || {}).headers || {}) },
});
const post = (path, body) => api(path, { method: "POST", body: JSON.stringify(body) });
const jsonOf = async (r) => { try { return await r.json(); } catch { return null; } };
/**
 * `src/routes/gallery.tsx` -> `/gallery`, for checking the page really stopped
 * serving.
 *
 * BOTH SPELLINGS, because the two lanes report differently and assuming one
 * cost a whole run. The BUILD reports `files` as `src/routes/index.tsx`; the
 * ADDON reports `added`/`reverted` as bare `gallery.tsx`. Anchored on the full
 * path only, a bare name matched nothing.
 *
 * AND IT ANSWERS "" RATHER THAN "/" WHEN IT CANNOT TELL. That fallback is what
 * turned the miss into a wrong result instead of a visible one: `gallery.tsx`
 * became `/`, so the deletion check asked the router to take the HOME page away
 * — which it correctly refused to flag, and the run reported the router as
 * broken when the router was right. A helper whose failure mode is "return the
 * home page" is the worst possible default for a helper used to name a page for
 * deletion. Callers filter it out, so an unreadable name skips rather than
 * pointing at something real.
 */
const routeOfAdded = (f) => {
  const m = String(f || "").match(/^(?:src\/routes\/)?(.+)\.tsx$/i);
  if (!m) return "";
  return m[1] === "index" ? "/" : "/" + m[1].replace(/\/index$/, "");
};

/** One routing call, exactly as the composer makes it. */
async function route(message, digest) {
  const r = await post("/api/site/route", {
    message, site: digest, firstBuild: false, brief: message, qa: [],
    answering: false, attached: false, slug, hasSite: true,
  });
  return (await jsonOf(r)) || {};
}

async function main() {
  // --- a throwaway, already-confirmed user ---------------------------------
  const mk = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST", headers: svc(),
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  let made = await jsonOf(mk);
  userId = made && made.id;
  // ALREADY THERE, ON THE SECOND RUN AND EVERY RUN AFTER. The fixture account is
  // a fixed address, so creating it answers "already registered" — find it and
  // reset its password rather than storing one anywhere.
  if (!userId && !FRESH) {
    const found = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`, { headers: svc() });
    const list = (await jsonOf(found)) || {};
    const hit = (list.users || []).find((u) => u && String(u.email || "").toLowerCase() === email.toLowerCase());
    if (hit && hit.id) {
      const reset = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${hit.id}`, {
        method: "PUT", headers: svc(), body: JSON.stringify({ password, email_confirm: true }),
      });
      made = await jsonOf(reset);
      userId = (made && made.id) || hit.id;
    }
  }
  ok(FRESH ? "created a throwaway user" : "the fixture account is ready", !!userId, JSON.stringify(made));
  if (!userId) return;

  const si = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  jwt = (await jsonOf(si) || {}).access_token;
  ok("signed in", !!jwt);
  if (!jwt) return;

  // A DIRECT LEDGER WRITE, not `add_credits` — that RPC is mint-key gated and
  // would write a `purchases` row, which makes the account read as having paid
  // and quietly changes watermarks, storage tier and `is_paid()`. The same
  // reasoning `build smoke` records for its own top-up.
  await fetch(`${SUPABASE_URL}/rest/v1/credits?on_conflict=user_id`, {
    method: "POST", headers: svc({ Prefer: "resolution=merge-duplicates" }),
    body: JSON.stringify({ user_id: userId, balance: 400 }),
  });

  // --- one real build, so there is something to edit ------------------------
  // ONE RETRY, BECAUSE THE BUILD IS A LOTTERY AND THE LANES ARE WHAT IS UNDER
  // TEST. Roughly one generation in five does not compile — measured, and the
  // documented rate — so without this a run has a ~20% chance of costing ~50
  // credits and eight minutes to prove nothing about the thing it exists for.
  // Losing twice is unlucky enough to be worth reporting as a failure.
  //
  // The slug changes on the retry: the first attempt CLAIMED the old one, so
  // building again at the same address is a revise, and a revise is a different
  // path with a different budget. It has to be a fresh first build.
  const brief = "A barber shop in Sheffield called Ridge & Bone. A price list of services, and a page where people can book a chair.";
  let b = {}, br = null;

  // ── IS THE FIXTURE ALREADY THERE? ─────────────────────────────────────────
  //
  // `/rows` answers 200 with this site's tables when it exists AND is ours —
  // `assertOwner` refuses anything else with a 404 — so one free read decides it
  // and doubles as the ownership check. `/text` then gives the page list, which
  // is everything the lanes need that the build response would have carried.
  //
  // ANYTHING UNEXPECTED FALLS THROUGH TO BUILDING. A missing site, a site that
  // is not ours, no tables, no pages: all of them build, which is exactly the
  // old behaviour and costs one ordinary run.
  //
  // EVERY NAME THE BUILD LOOP COULD HAVE LEFT BEHIND, newest first: a run that
  // missed once put the real site at `-r1` and the bare slug holds nothing but a
  // claimed husk, so looking only at the bare slug finds the wrong one and pays
  // to rebuild.
  if (!FRESH) {
    for (let a = ATTEMPTS - 1; a >= 0 && !reused; a--) {
      const cand = slugFor(a);
      try {
        const rowsR = await api(`/api/site/${cand}/rows`);
        const txtR = await api(`/api/site/${cand}/text`);
        const tabs = ((await jsonOf(rowsR)) || {}).tables || [];
        const src = ((await jsonOf(txtR)) || {}).pages || [];
        if (rowsR.status === 200 && txtR.status === 200 && tabs.length && src.length) {
          reused = true;
          slug = cand;
          b = {
            page: "app",
            files: src.map((x) => x && x.path).filter(Boolean),
            tables: tabs.map((t) => t && t.name).filter(Boolean),
            brand: "", url: `https://${slug}.gofarther.app`,
          };
          br = { status: 200 };
          console.log(`\nreusing ${slug} — no build, ~25 credits and ~2.5 minutes saved`);
          console.log(`   pages: ${JSON.stringify(b.files)}`);
          console.log(`   tables: ${JSON.stringify(b.tables)}`);
        }
        // WHAT EACH CANDIDATE ANSWERED, because "we are building" and "we could
        // not reuse" look identical from the log otherwise — and a reuse that
        // silently stops working reads as an ordinary run costing 25 credits
        // rather than as the regression it is.
        else console.log(`   ${cand}: rows=${rowsR.status}/${tabs.length} text=${txtR.status}/${src.length} — not reusable`);
      } catch (e) { console.log(`   ${cand}: ${e && e.message} — not reusable`); }
    }
  }

  if (!reused) console.log(`\nbuilding a real site… ${slugFor(0)}`);
  for (let attempt = 0; !reused && attempt < ATTEMPTS; attempt++) {
    if (!FRESH) slug = slugFor(attempt);
    if (attempt) {
      if (FRESH) slug = `${slug}-r${attempt}`;
      console.log(`   the generator missed — one more, at ${slug}`);
    }
    const t0 = Date.now();
    br = await post("/api/site/react-build", { slug, brief, picker: "sonnet" });
    b = (await jsonOf(br)) || {};
    console.log(`   ${Math.round((Date.now() - t0) / 1000)}s, ${b.cost} credits, page=${b.page}, files: ${(b.files || []).length}`);
    // WHY IT MISSED, ON THE ATTEMPT LINE. A failed build's reason lives in
    // fields nothing printed until the assertion 15 lines below, which reports
    // once for a loop that ran twice — so two different faults read as one.
    if (br.status !== 200 || b.page !== "app") {
      console.log(`   stage=${b.stage} upstream=${b.upstream} type=${b.upstreamType} kind=${b.kind}${b.why ? " why=" + b.why : ""}`);
    }
    if (br.status === 200 && b.page === "app") break;
    // AND NEVER RETRY INTO AN EMPTY ACCOUNT. The retry exists for the
    // generator lottery; a refusal for want of credit will refuse again,
    // so a second attempt is a second Neon project and another minute for
    // an answer already known.
    if (b && b.billing === true) break;
  }
  // 900, matching the printer. A producer cap of 200 under a printer cap of 900
  // is two limits where only the smaller one is real — the exact bug the `ok`
  // comment records, still live one call site over, and it is why a design
  // failure's `kind` was invisible on the line written to explain it.
  if (!reused) ok("the build returns 200", br.status === 200, `${br.status} ${JSON.stringify(b).slice(0, 900)}`);
  if (!reused) ok("a real app was published, not the placeholder", b.page === "app",
    `page=${b.page} stage=${b.stage} error=${String(b.error || "").slice(0, 200)}`);
  // EVERYTHING BELOW NEEDS A REAL APP. On the placeholder there is no page source
  // to edit and no nav to add to, so the lanes would correctly refuse and the run
  // would report a pile of failures about a build that never happened.
  if (!funded(b)) return;
  if (b.page !== "app") { console.log("\nskipping the lanes — the build fell back to the placeholder"); return; }

  // A LEFTOVER PAGE FROM A RUN THAT DIED BEFORE ITS OWN CLEANUP.
  //
  // The addon adds a page and the deletion takes it away, so a green run leaves
  // the fixture exactly as it found it. A run that dies in between does not —
  // and the next addon would then be adding a second one beside it, which is a
  // different test than the one written here. Cleared with the cheap lane, and
  // best-effort: a failure to tidy is reported and never fails the run.
  if (reused) {
    for (const stale of (b.files || []).filter((f) => /gallery|photos|work-gallery/i.test(f))) {
      const staleRoute = routeOfAdded(stale);
      if (!staleRoute || staleRoute === "/") continue;
      const wipe = await post(`/api/site/${slug}/edit`, {
        layer: "page", page: staleRoute, remove: true,
        instruction: `Remove the ${staleRoute.slice(1)} page`, picker: "sonnet",
      });
      const w = (await jsonOf(wipe)) || {};
      console.log(`   tidied a leftover ${staleRoute}: ${w.ok ? "removed" : (w.error || wipe.status)}`);
      if (w.ok) b.files = (b.files || []).filter((f) => f !== stale);
    }
  }

  // ROUTES, NOT SOURCE PATHS — and getting this wrong made the router look broken
  // when it was right. The build reports `files` as `src/routes/index.tsx`; the
  // composer's digest carries `/` and `/book`. Fed the source paths, `readEdit`
  // correctly refused to name a page it had not been shown and fell back to
  // addon, which is the guard working. A check that claims to drive the route
  // "exactly as the composer makes it" has to send what the composer sends.
  const routes = (b.files || []).map(routeOfAdded).filter(Boolean).slice(0, 24);
  ok("the digest carries ROUTES, the way the composer sends them",
    routes.length > 0 && routes.every((r) => r.startsWith("/")), JSON.stringify(routes));
  const digest = { name: b.brand || "", url: b.url || "", pages: routes, tables: b.tables || [] };

  // --- what the site stores, so the instructions can name something real ----
  const tr = await api(`/api/site/${slug}/rows`);
  const tabs = ((await jsonOf(tr)) || {}).tables || [];
  const display = tabs.find((t) => t.access === "display" && (t.count || 0) > 0) || tabs[0];
  ok("the site stores something we can edit", !!display, JSON.stringify(tabs).slice(0, 200));
  if (!display) return;
  const rowsOf = async () => (((await jsonOf(await api(`/api/site/${slug}/rows/${display.name}`))) || {}).rows) || [];
  let rows = await rowsOf();
  // THE DETAIL IS THE POINT HERE. This failed live on 2026-08-12 reading only
  // `0 rows`, and answering WHY took a source audit rather than a glance: the
  // reason a table is not seeded lived solely in a Cloudflare log, and the site
  // had already been deleted by the run's own cleanup. `seedSkipped` is on the
  // build response now, so the next failure names its own cause.
  ok(`"${display.name}" came back seeded`, rows.length > 0,
    `${rows.length} rows · seeded=${JSON.stringify(b.seeded || {})} skipped=${JSON.stringify(b.seedSkipped || [])}`);
  // AN EMPTY MENU MUST NOT THROW THE WHOLE RUN AWAY, and it did twice tonight.
  // Only the DATA lane needs a row to name in a sentence; the router, the look
  // lane, the rules lane, the addon lane and the page deletion all work fine on
  // an empty table — the rules lane names the TABLE, not a row. Returning here
  // meant one build-lottery outcome cost 30-odd checks that had nothing to do
  // with it, and the deletion fix this run existed to prove was among them.
  // Same lesson as "one bad page cost the whole site": stub the part that is
  // broken, keep everything that still works. The failure above is still a
  // failure — it is a real defect and the run stays red.
  const col = rows.length
    // The first column that carries words — what a person would name in a sentence.
    ? (display.columns || []).find((c) => typeof rows[0][c] === "string" && rows[0][c].trim())
    : null;
  const first = col ? String(rows[0][col]) : "";
  if (rows.length) ok("…and a row we can name in an instruction", !!first, JSON.stringify(rows[0]).slice(0, 160));
  // Deliberately NOT a skipped assertion that reads as a pass: `ok()` counts,
  // and a check silently recorded as green on a run where it never ran is the
  // one failure mode a live harness must not have.
  if (!first) console.log("\nskipping the DATA lane — the build produced no row to name");

  // ── THE ROUTER ────────────────────────────────────────────────────────────
  //
  // Never driven live before. Every claim about which lane a sentence lands in
  // came from unit tests against fake model replies.
  console.log("\nthe router picks a lane…");
  if (first) {
    const rData = await route(`Change the price of the ${first} to £26`, digest);
    ok("a price change routes to the DATA layer", rData.intent === "edit" && rData.layer === "data",
      `intent=${rData.intent} layer=${rData.layer}`);
  }
  const rLook = await route("Make the background a warm cream", digest);
  ok("a colour change routes to the LOOK layer", rLook.intent === "edit" && rLook.layer === "look",
    `intent=${rLook.intent} layer=${rLook.layer}`);
  const rAdd = await route("Add a gallery page showing our work", digest);
  ok("a new page routes to the ADDON lane", rAdd.intent === "addon", `intent=${rAdd.intent}`);
  // The cheapest interaction there is must not build anything.
  const rAsk = await route("Can you read a link if I paste one?", digest);
  ok("a question is answered, not built", rAsk.intent === "ask" && !!rAsk.answer,
    `intent=${rAsk.intent} answer=${String(rAsk.answer || "").slice(0, 80)}`);

  if (first) {
    // ── THE DATA LAYER: a row changes, and NOTHING is recompiled ──────────────
    console.log("\nchanging a row…");
    const ed = await post(`/api/site/${slug}/edit`, {
      layer: "data", instruction: `Change the price of the ${first} to £26`, picker: "sonnet",
    });
    const e = (await jsonOf(ed)) || {};
    if (!funded(e)) return;
    ok("the data edit succeeds", ed.status === 200 && e.ok === true, `${ed.status} ${JSON.stringify(e).slice(0, 200)}`);
    ok("…and it says which rows moved", Array.isArray(e.applied) && e.applied.length > 0, JSON.stringify(e.applied));
    // THE POINT OF THIS LANE: rows are read at runtime, so nothing is rebuilt and
    // nothing is republished. A recompile here would mean the cheapest change on
    // the platform is quietly paying for the most expensive step.
    ok("…and no files were republished", !e.files || !e.files.length, JSON.stringify(e.files || []).slice(0, 120));
    rows = await rowsOf();
    // MANAGED COLUMNS STRIPPED FIRST, because with them in this check could
    // never fail: `created_at` is a 2026 timestamp, so `includes("26")` was true
    // of every row of every table on every run. Caught by reading a live log
    // where the edit answered 422 `write` — applied nothing — and this still
    // reported `ok`. An assertion that cannot fail is worse than none: it is the
    // one that says a broken write worked.
    const vals = rows.map((r) => {
      const o = { ...r };
      for (const k of ["id", "created_at", "updated_at", "owner_id", "team_id"]) delete o[k];
      return o;
    });
    ok("the change really is in the database", JSON.stringify(vals).includes("26"), JSON.stringify(vals).slice(0, 200));

    // ── REMOVING A ROW, AND PUTTING IT BACK ───────────────────────────────────
    //
    // Both shipped today. The removal was refused outright until this morning, and
    // the undo it offers is only real because the client carries the deleted row
    // forward — the row is gone from the table, so nothing on the server can see
    // what "put it back" refers to.
    console.log("\nremoving a row, and undoing it…");
    const before = (await rowsOf()).length;
    const rm = await post(`/api/site/${slug}/edit`, {
      layer: "data", instruction: `Take the ${first} off the list entirely`, picker: "sonnet",
    });
    const r2 = (await jsonOf(rm)) || {};
    const gone = (r2.applied || []).filter((x) => x && x.removed);
    ok("a row can be removed at all", rm.status === 200 && r2.ok === true && gone.length > 0,
      `${rm.status} ${JSON.stringify(r2).slice(0, 200)}`);
    ok("…and the row's contents come back for the undo", !!(gone[0] && gone[0].was),
      JSON.stringify(gone[0] || {}).slice(0, 200));
    const after = (await rowsOf()).length;
    ok("…and it really is gone from the database", after === before - 1, `${before} → ${after}`);

    if (gone[0] && gone[0].was) {
      // EXACTLY WHAT THE CLIENT SENDS: the last removal, carried forward. Without
      // it the model is handed an instruction with no referent and matches nothing.
      const undo = await post(`/api/site/${slug}/edit`, {
        layer: "data", instruction: "Actually put that back, I didn't mean to delete it", picker: "sonnet",
        recent: [{ table: gone[0].table, was: gone[0].was }],
      });
      const u = (await jsonOf(undo)) || {};
      ok("the undo is accepted", undo.status === 200 && u.ok === true, `${undo.status} ${JSON.stringify(u).slice(0, 200)}`);
      const back = await rowsOf();
      ok("…and the row is really back", back.length === before && JSON.stringify(back).includes(first),
        `${after} → ${back.length}`);
    }
  }

  // ── THE LOOK LAYER, AND THE RENAME ────────────────────────────────────────
  //
  // A rename used to move the stored brand and leave every visible heading
  // saying the old name — the browser tab and the link preview changed, the page
  // did not, and it reported success. That is the half only a live run can see.
  console.log("\nrenaming the business…");
  const newName = `Ridge & Bone ${stamp.slice(-4).toUpperCase()}`;
  const lk = await post(`/api/site/${slug}/edit`, {
    layer: "look", instruction: `Change the name of the business to "${newName}"`, picker: "sonnet",
  });
  const l = (await jsonOf(lk)) || {};
  // 900, NOT 200. This is where a `compile` failure lands, and its `detail` is
  // the container's own output — which LEADS with Vite's benign
  // `new URL("../", import.meta.url)` warning from main.tsx, so 200 characters
  // showed the warning and cut off the actual error. Measured 2026-08-12: the
  // rename failed four checks and the cause was not in the log.
  if (!funded(l)) return;
  ok("the look edit succeeds", lk.status === 200 && l.ok === true, `${lk.status} ${JSON.stringify(l).slice(0, 900)}`);
  ok("…and it reports the brand moved", (l.moved || []).includes("brand"), JSON.stringify(l.moved));
  ok("…and the rename reached the PAGES, not just the stored brand", (Number(l.renamed) || 0) > 0,
    `renamed=${l.renamed}`);
  // `siteUrlFor` FALLS BACK TO A PATH, so `b.url` is sometimes `/s/<slug>/` and
  // not an absolute URL — measured on the first run, where `fetch` threw
  // "Failed to parse URL" and took the rest of the run with it. Resolved
  // against the base rather than assumed absolute.
  const liveUrl = b.url ? new URL(b.url, BASE).toString() : "";
  if (liveUrl) {
    const live = await fetch(liveUrl, { headers: { "user-agent": "Mozilla/5.0 (edit-smoke)" } });
    const html = await live.text().catch(() => "");
    // THE ONE ASSERTION THAT COULD NOT BE MADE FROM A UNIT TEST: the published
    // page, fetched over the wire, says the new name.
    //
    // BOTH FORMS, because the first run failed on an ampersand. The name carries
    // an `&`, the prerendered HTML escapes it to `&amp;`, and a raw `includes`
    // could never match — reporting a rename that had in fact landed as broken.
    // A check that cannot pass is worse than no check.
    const esc = newName.replace(/&/g, "&amp;");
    ok("…and the PUBLISHED page says the new name", html.includes(newName) || html.includes(esc),
      `${live.status}, ${html.length} bytes, looked for ${JSON.stringify(newName)} and its escaped form`);
  }

  // ── THE RULES LAYER: what the site DOES, proved against the real API ──────
  //
  // ASSERTED THROUGH THE PUBLIC DATA API, NOT THROUGH OUR OWN 200. A rule that
  // returns `ok:true` and does not reach Postgres is exactly the failure this
  // layer was built to fix — the addon merge dropped `confirm`, `payment` and
  // `noOverlap` silently for months and looked like success from both ends. So
  // the check is behavioural: close a table with a rule, watch a stranger be
  // refused by the database, reopen it, watch them be let back in.
  console.log("\nchanging a rule, and proving it at the database…");
  const publicRead = (table) => fetch(`${BASE}/api/db/${slug}/data/${table}?select=*`);
  const openBefore = await publicRead(display.name);
  ok(`"${display.name}" is publicly readable to begin with`, openBefore.status === 200,
    `${openBefore.status} — without this the close below proves nothing`);

  const rRules = await route(`Close the ${display.name} list — nobody outside should see it for now`, digest);
  ok("a rule change routes to the RULES layer", rRules.intent === "edit" && rRules.layer === "rules",
    `intent=${rRules.intent} layer=${rRules.layer}`);

  const shut = await post(`/api/site/${slug}/edit`, {
    layer: "rules", instruction: `Close the ${display.name} list — nobody outside should be able to see it`, picker: "sonnet",
  });
  const sh = (await jsonOf(shut)) || {};
  if (!funded(sh)) return;
  ok("the rule change succeeds", shut.status === 200 && sh.ok === true, `${shut.status} ${JSON.stringify(sh).slice(0, 240)}`);
  // THE POINT OF THE LANE, and the same property the data layer has: a rule is
  // enforced in Postgres and on the request path, so no page source changed and
  // nothing was rebuilt.
  ok("…and nothing was republished", !sh.files || !sh.files.length, JSON.stringify(sh.files || []).slice(0, 120));
  ok("…and it says which table moved", (sh.applied || []).length > 0, JSON.stringify(sh.applied));

  const closed = await publicRead(display.name);
  ok("THE DATABASE REALLY REFUSES A STRANGER NOW", closed.status === 401 || closed.status === 403 || closed.status === 404,
    `${closed.status} ${(await closed.text().catch(() => "")).slice(0, 200)}`);

  // AND IT COMES BACK. A rule that can only be applied is a deletion wearing
  // another name — an owner who closes a form for a busy weekend has to be able
  // to open it on Monday, and that reopening is a second real schema apply.
  const open = await post(`/api/site/${slug}/edit`, {
    layer: "rules", instruction: `Open the ${display.name} list up again so anyone can see it`, picker: "sonnet",
  });
  const op = (await jsonOf(open)) || {};
  ok("the rule can be put back", open.status === 200 && op.ok === true, `${open.status} ${JSON.stringify(op).slice(0, 200)}`);
  const reopened = await publicRead(display.name);
  ok("…and the database lets them back in", reopened.status === 200,
    `${reopened.status} ${(await reopened.text().catch(() => "")).slice(0, 200)}`);

  // ── THE ADDON LANE ────────────────────────────────────────────────────────
  console.log("\nadding a page, then taking it away…");
  const ad = await post(`/api/site/${slug}/addon`, {
    instruction: "Add a gallery page showing photographs of our work, and link to it from the header",
    picker: "sonnet",
  });
  const a = (await jsonOf(ad)) || {};
  if (!funded(a)) return;
  ok("the addon succeeds", ad.status === 200 && a.ok === true, `${ad.status} ${JSON.stringify(a).slice(0, 240)}`);
  const added = (a.added || [])[0];
  ok("…and a page was added", !!added, JSON.stringify(a.added));
  // THE WHOLE POINT OF THE LANE: it adds without rewriting. Measured on the first
  // run: the model returned all four existing pages changed, for 28 credits. The
  // merge reverts a rewrite that is not carrying a link now, so what is asserted
  // is the PROPERTY — every page it kept as changed has a reason — rather than a
  // count the model happens to land on.
  const kept2 = (a.changed || []).length, put = (a.reverted || []).length;
  // CALIBRATED AGAINST A BROKEN `routeOf`, and it went red the moment that was
  // fixed. The lane reverts a changed page that does NOT mention a route it just
  // added — and `routeOf` answered "" for every page, so the list of new routes
  // was always empty and almost everything got reverted. `<= 2` was a proxy for
  // that behaviour, not for the property.
  //
  // With the fix, the nav link lands in a SHARED header, so every page in the
  // site legitimately carries it: `changed=["index.tsx","book.tsx","work.tsx"]`
  // with nothing reverted is the lane working, not running away with the site.
  // The real property is that it does not rewrite MORE than the site has, and
  // that whatever it kept, it can name.
  const totalPages = (b.files || []).length + 1; // +1 for the page it just added
  ok("…and every page it changed was carrying the new link",
    kept2 <= totalPages && (a.changed || []).every((f) => typeof f === "string" && f),
    `changed=${JSON.stringify(a.changed)} reverted=${JSON.stringify(a.reverted)} of ${totalPages} pages`);
  if (put) console.log(`   reverted ${put} page(s) the model rewrote for no reason: ${JSON.stringify(a.reverted)}`);

  if (added) {
    // THE ROUTER DECIDES A DELETION NOW, not the pages model. Three attempts to
    // get the model to volunteer it failed against words it was demonstrably
    // reading, so the route it takes is: one Haiku routing call, then a merge and
    // a recompile — no page generation at all.
    // ASK FOR THE PAGE THAT WAS ACTUALLY MADE. This said "the gallery page"
    // whatever the addon had named the file — so if the model called it
    // `work.tsx`, the router was asked to remove a page the digest does not
    // list, and answering `page: "/"` with no `remove` is then the RIGHT answer
    // to a question that should never have been asked. Measured 2026-08-12:
    // `intent=edit layer=page remove=undefined page=/`, with nothing in the log
    // saying what the added page was called.
    const goneRoute = routeOfAdded(added);
    const goneName = goneRoute.replace(/^\//, "").replace(/-/g, " ");
    // NEVER ASK TO DELETE THE HOME PAGE. The merge refuses it by design, so a
    // check that asks for it is testing the guard and reporting it as a routing
    // failure — which is exactly what happened when an unparsed filename fell
    // through to "/". If the added page cannot be named, there is nothing here
    // to drive and saying so is the honest outcome.
    const sent = [...new Set([...(digest.pages || []), goneRoute].filter(Boolean))];
    if (!goneName) console.log(`   skipping the deletion — can't name the added page from ${JSON.stringify(added)}`);
    const rmRoute = goneName ? await route(`Remove the ${goneName} page`, { ...digest, pages: sent }) : null;
    if (rmRoute) ok("a deletion routes to the page layer with `remove`",
      rmRoute.intent === "edit" && rmRoute.layer === "page" && rmRoute.remove === true,
      `intent=${rmRoute.intent} layer=${rmRoute.layer} remove=${rmRoute.remove} page=${rmRoute.page} ` +
      `· asked to remove "${goneName}" (${added}) · pages sent ${JSON.stringify(sent)}`);
    if (rmRoute && rmRoute.remove === true) {
      const cut = await post(`/api/site/${slug}/edit`, {
        layer: "page", page: rmRoute.page, remove: true, instruction: `Remove the ${goneName} page`, picker: "sonnet",
      });
      const c = (await jsonOf(cut)) || {};
      // A REFUSAL BECAUSE OTHER PAGES STILL LINK TO IT IS THE GUARD WORKING, not
      // a failure — and asserting a one-step deletion was asserting a flow this
      // product deliberately does not have. Measured live: `error: "kept"`,
      // *"I left /gallery — /, /book, /work still link to it. Ask me to take the
      // link out first."* Deleting it anyway leaves three pages linking into
      // nothing, which is the whole reason the merge refuses.
      //
      // So the outcome is EITHER gone, or refused with the reason and the pages
      // named. Anything else — a silent refusal, or a claim of success with
      // nothing removed — is still a failure.
      const cutGone = cut.status === 200 && c.ok === true && (c.removed || []).length > 0;
      const cutHeld = c.error === "kept" && /link/i.test(String(c.msg || ""));
      ok("the page is deleted, or the refusal names what still links to it", cutGone || cutHeld,
        `${cut.status} ${JSON.stringify(c).slice(0, 240)}`);
      // THE WHOLE POINT: it cost nothing but a recompile.
      ok("…and it cost nothing to generate", c.cost === 0, `cost=${c.cost}`);
      const after = await fetch(new URL(`${routeOfAdded(added)}`, liveUrl || BASE).toString(),
        { headers: { "user-agent": "Mozilla/5.0 (edit-smoke)" } }).catch(() => null);
      if (after) console.log(`   the removed page now answers ${after.status}`);
    }

    // And the addon lane's own removal, which is the path when something still
    // links to the page and the links have to come out first.
    const rmp = await post(`/api/site/${slug}/addon`, {
      instruction: `Actually remove the ${goneName} page again, and take the link out of the header`,
      picker: "sonnet",
    });
    const p = (await jsonOf(rmp)) || {};
    // A REFUSAL IS A RESULT TOO. If it declined because something still links to
    // the page, that is the guard working — but it must SAY so rather than
    // reporting success, which is what the `kept` field is for.
    const removed = (p.removed || []).length > 0;
    const kept = (p.kept || []).length > 0;
    // `problems` IS THE EXPLANATION ON THIS PATH, and leaving it out was the last
    // thing failing. Measured live: the cheap lane had already deleted the page,
    // so the addon found links pointing at something that no longer exists, took
    // them out, and said exactly that — `ok: true`, `changed: ["index.tsx"]`,
    // `problems: ["These pages were linked to and do not exist…"]`. Nothing
    // removed and nothing kept, because there was nothing left to remove. That
    // is the lane being right, reported in the field it reports problems in.
    const explained = removed || kept || !!p.msg || (p.problems || []).length > 0;
    ok("a page can be removed, or the refusal explains itself", explained,
      `${rmp.status} ${JSON.stringify(p).slice(0, 240)}`);
    if (removed) ok("…and the page really went", (p.removed || []).includes(added), JSON.stringify(p.removed));

    // ── AND THEN THE WHOLE JOURNEY, WHICH IS THE POINT ────────────────────
    //
    // The design is two steps and the check never drove them: the page layer
    // refuses a page other pages link to, and the addon lane is the rung that
    // takes the links out. Measured live 2026-08-12 — the addon changed all
    // three linking pages and did NOT remove the page, so from outside it read
    // as a failure when the customer was in fact one step from done.
    //
    // If the addon took the links out, the cheap deletion must now succeed. That
    // is the sentence a customer would type next, and until this it was never
    // driven.
    if (!removed && (p.changed || []).length) {
      const again = await post(`/api/site/${slug}/edit`, {
        layer: "page", page: rmRoute.page, remove: true,
        instruction: `Remove the ${goneName} page`, picker: "sonnet",
      });
      const g = (await jsonOf(again)) || {};
      ok("…and with the links gone, the cheap deletion goes through",
        again.status === 200 && g.ok === true && (g.removed || []).length > 0,
        `${again.status} ${JSON.stringify(g).slice(0, 240)}`);
      ok("…and it still cost nothing to generate", g.cost === 0, `cost=${g.cost}`);
    }
  }

  // --- and the owner can take it all down ----------------------------------
  // KEPT WHENEVER WE ARE IN FIXTURE MODE — not only when this run reused one,
  // which is the bug that would have made the whole saving impossible. On the
  // FIRST fixture run nothing exists yet, so the site is built rather than
  // reused; deleting it at the end would leave the next run with nothing to
  // reuse either, and it would build again, forever. The condition has to be
  // "are we keeping a fixture", not "did we find one".
  //
  // The site-delete route is still exercised on a fresh run (SMOKE_FRESH=1),
  // which is what proves it.
  if (!FRESH) {
    console.log(`\n${reused ? "keeping" : "leaving"} ${slug} for the next run — the build is what costs, and it is now paid for`);
    deleted = true; // stops the teardown removing it
    return;
  }
  console.log("\ncleaning up…");
  const del = await api(`/api/site/${slug}`, { method: "DELETE" });
  ok("the owner can delete the site", del.status === 200, String(del.status));
  deleted = true;
}

main()
  .catch((e) => { failed++; console.log("  FAIL the run threw  -> " + String((e && e.message) || e).slice(0, 300)); })
  .finally(async () => {
    // The Neon project first — it is a capped, billed resource whose only record
    // is a Supabase row, and deleting the user cascades that row away.
    // THE SITE FIRST, AND ON EVERY EXIT. The placeholder path returns early and
    // skipped this, leaving the published files in R2 with the Supabase row about
    // to cascade away underneath them — the orphaned-prefix state that needs an
    // operator sweeper to clear. A test must not manufacture the one condition
    // the platform has no self-service answer for.
    // ON A THROW, TOO. A fixture run that dies mid-way must not have its site or
    // its Neon project swept — that is the thing being kept, and losing it means
    // the next run pays for a build again. A fresh run still tears everything
    // down on every exit, which is what stops an orphaned prefix.
    try { if (FRESH && jwt && slug && !deleted) await api(`/api/site/${slug}`, { method: "DELETE" }).catch(() => {}); } catch { /* best effort */ }
    try { if (FRESH && userId && env.NEON_API_KEY) await dropUserProject(env, userId).catch(() => {}); } catch { /* best effort */ }
    if (userId && FRESH) {
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: svc() }).catch(() => {});
      console.log("  removed the throwaway user");
    } else if (!FRESH) {
      console.log(`  kept the fixture account and ${slug}`);
    }
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  });
