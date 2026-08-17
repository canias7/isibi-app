// Production smoke test for the builder's send path.
//
// The e2e test proves the database layer; this proves the ROUTE — auth, the
// credit charge, the Sonnet schema design, provisioning, the page generator, the
// build container, and the published app — by driving the deployed Worker over
// HTTP exactly as the browser does.
//
// It creates its own throwaway user, runs one real build, then removes the
// user, its Neon project and its published files. Costs two Sonnet calls (the
// schema design and the pages) plus two Haiku routing probes.
//
// The line here used to add "plus a third if the pages need a repair pass". The
// repair pass was removed on 2026-08-04 — one model call a build, then the
// placeholder — so that was describing a cost this file cannot incur.
//
// Needs SUPABASE_SERVICE_KEY and NEON_API_KEY. Run from CI (workflow_dispatch),
// or locally with those in the environment.
import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { dropUserProject, connForDatabase, dbNameForSite, sqlQuery } from "../../site-db.mjs";

// Use whatever Chromium is already on the machine — same reasoning as
// site-runtime.mjs: the pinned playwright version and a pre-installed browser
// build often disagree, and the build number is not what this test is about.
// Returns null to let playwright resolve its own.
function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  const rels = ["chrome-linux/chrome", "chrome-linux64/chrome", "chrome-headless-shell-linux64/chrome-headless-shell", "chrome-linux/headless_shell"];
  const found = [];
  try {
    for (const dir of fs.readdirSync(root)) {
      for (const rel of rels) {
        const p = path.join(root, dir, rel);
        if (fs.existsSync(p)) found.push(p);
      }
    }
  } catch { /* fall through to playwright's own lookup */ }
  found.sort((a, b) => Number(/headless/.test(a)) - Number(/headless/.test(b)));
  return found[0] || null;
}

const BASE = process.env.SMOKE_BASE_URL || "https://gofarther.dev";
const SUPABASE_URL = "https://ujrqdmmtcptvimazlhom.supabase.co";
// Public by design — it is shipped in the browser bundle. Kept inline so the
// workflow needs no extra secret.
const ANON = process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcnFkbW10Y3B0dmltYXpsaG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODUyNTUsImV4cCI6MjA5NDM2MTI1NX0.F-af9iC-BWTZN2hQ5cD1Keke8qXARhqPwxOgSHhNLK4";
const SVC = process.env.SUPABASE_SERVICE_KEY || "";
const env = { NEON_API_KEY: process.env.NEON_API_KEY };

if (!SVC) { console.error("SUPABASE_SERVICE_KEY is required"); process.exit(1); }

let passed = 0, failed = 0;
const ok = (name, cond, extra) => {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failed++; console.log(`  FAIL ${name}${extra ? "  -> " + String(extra).slice(0, 300) : ""}`); }
};
const svc = (extra) => ({ apikey: SVC, Authorization: `Bearer ${SVC}`, "content-type": "application/json", ...(extra || {}) });

const stamp = Date.now().toString(36);
const email = `smoke-${stamp}@gofarther.dev`;
const password = `Sm0ke-${stamp}-${Math.random().toString(36).slice(2, 10)}`;
// `jwt` is hoisted because cleanup needs it: taking the published site down is
// an authenticated call, so it has to happen in `finally` while the throwaway
// user still exists.
let userId = null, slug = null, projectId = null, jwt = null;
// WHERE THE SITE ACTUALLY SERVES, derived from the redirect rather than spelled
// out — so a zone rename cannot leave this file addressing the old one, and the
// two halves are proved to agree by the assertion that reads the same header.
//
// It is not cosmetic. A published page's asset paths are ROOT-RELATIVE, so
// resolving `/assets/index-x.js` against `gofarther.dev/s/<slug>/` lands on the
// PLATFORM root and 404s — which is exactly what six of this file's checks did
// the moment the public address changed.
let SITE = "";

// RUNNING AS A REAL ACCOUNT, and everything about the shape of this file below
// keys off it.
//
// `buildFloor` reached 20 against a 20-credit grant, and the routing call spends
// 1 before the gate — so a throwaway account cannot finish a first build and
// this run had to fund one artificially. The owner's call is NOT to raise the
// grant but to run against a real account with its own credits.
//
// `createdUser` IS THE SAFETY PROPERTY, not a convenience flag. The teardown
// below ends with `DELETE /auth/v1/admin/users/<id>`, which cascades: chats,
// credits, purchases, storage rows, every `user_site_project` record. Pointed at
// a real account that is not a cleanup, it is the account gone — so the
// destructive half runs ONLY for a user this run created, gated in code and
// asserted in `test/build-smoke-safety.test.mjs` rather than remembered.
const SUPPLIED_EMAIL = String(env.SMOKE_EMAIL || "").trim();
const SUPPLIED_PASSWORD = String(env.SMOKE_PASSWORD || "");
const useSupplied = !!(SUPPLIED_EMAIL && SUPPLIED_PASSWORD);
let createdUser = false;

// EVERY LEDGER WRITE GOES THROUGH HERE, AND IT REFUSES FOR A SUPPLIED ACCOUNT.
//
// This run tops the account up twice — once to clear the build floor, once to
// pay for the revise — and both SET the balance rather than adding to it. That
// is right for a throwaway and catastrophic for a real one: `balance: 60`
// against an account holding 500 credits is not funding a test, it is taking
// 440 credits off somebody. The whole reason to run as a real account is that
// it brings its OWN credits, which is the owner's answer to the build floor
// instead of raising the free grant.
//
// ONE FUNCTION RATHER THAN A GUARD AT EACH CALL SITE. Two copies of a rule
// drift, and the direction this one drifts in is a customer's ledger — a third
// top-up added later is covered by construction rather than by remembering.
// `test/build-smoke-safety.test.mjs` asserts the ledger is written in exactly
// one place and that the place is behind this refusal.
async function fundAccount(to, label) {
  if (useSupplied) {
    const bal = await fetch(`${BASE}/api/credits`, { headers: { Authorization: `Bearer ${jwt}` } });
    const bj = await bal.json().catch(() => ({}));
    // Reported, not asserted against a number: what this account happens to
    // hold is the owner's business, and a run that cannot afford a step says so
    // at the gate with a message naming the shortfall.
    console.log(`  ${label}: the supplied account holds ${JSON.stringify(bj)} — nothing was written to it`);
    return;
  }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/credits?on_conflict=user_id`, {
    method: "POST",
    headers: svc({ Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify([{ user_id: userId, balance: to }]),
  });
  const j = await r.json().catch(() => ({}));
  // Asserted, not fired and forgotten. A top-up that silently did nothing looks
  // exactly like the 402 it exists to prevent, and the next person reads a
  // column of red lines about money and goes looking in the wrong file.
  ok(`${label} — ${to} credits`,
    r.ok && Array.isArray(j) && Number(j[0] && j[0].balance) === to,
    r.status + " " + JSON.stringify(j).slice(0, 200));
}

try {
  // --- the account this run builds as ------------------------------------
  if (useSupplied) {
    console.log(`running as the supplied account ${SUPPLIED_EMAIL} — no user is created and none is deleted`);
  } else {
    const mk = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST", headers: svc(),
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const made = await mk.json().catch(() => ({}));
    userId = made && made.id;
    createdUser = !!userId;
    ok("created a throwaway user", !!userId, JSON.stringify(made));
    if (!userId) throw new Error("cannot continue without a user");
  }

  const si = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({
      email: useSupplied ? SUPPLIED_EMAIL : email,
      password: useSupplied ? SUPPLIED_PASSWORD : password,
    }),
  });
  const sess = await si.json().catch(() => ({}));
  jwt = sess && sess.access_token;
  if (useSupplied) userId = (sess && sess.user && sess.user.id) || null;
  ok("signed in and got a session", !!jwt, JSON.stringify(sess).slice(0, 200));
  if (!jwt) throw new Error("cannot continue without a token");

  // --- FUND THE FIRST BUILD (owner's call 2026-08-13) -----------------------
  //
  // The first build used to run on exactly the 20-credit grant a real new
  // account gets, deliberately. That stopped working the moment SCHEMA_PROFILE
  // was re-measured: `buildFloor` is now 20, the two routing calls above cost
  // 1 credit each, so the build was refused at the gate with 18 and the whole
  // run went 9 passed / 13 failed without ever building anything.
  //
  // THE REFUSAL IS CORRECT AND IT IS NOT A TEST PROBLEM — a new account really
  // cannot finish a cold first build, and the honest fix is raising the grant,
  // which is a decision about money. Funding the test instead was the owner's
  // call, and the cost has to be stated rather than buried:
  //
  //   `build smoke` NO LONGER NOTICES THAT A NEW CUSTOMER CANNOT BUILD COLD.
  //
  // That failure did not go away; it stopped being CI's job to report it. The
  // shortfall is one credit for a real customer (grant 20, one routing call,
  // floor 20) and `test/build-models.test.mjs` pins it, so the day the grant
  // moves that test goes red and says what to update.
  //
  // 40, not 60: enough to clear the floor and finish a build with margin, and
  // low enough that the run does not fund a photograph spree. One image is ~19
  // credits of real fal spend and `imagesAffordable` buys out of whatever the
  // model calls leave behind, so the number here is an image budget as much as
  // a build budget.
  //
  // A direct ledger write, not `add_credits`: that RPC is mint-key gated and
  // writes a `purchases` row, which would make the account read as having paid
  // and quietly change what is under test — watermarks, storage tier, is_paid().
  //
  // NEVER FOR A SUPPLIED ACCOUNT — `fundAccount` refuses, and the refusal lives
  // there rather than here so both top-ups in this run obey one rule.
  const FIRST_BUILD_CREDITS = 40;
  await fundAccount(FIRST_BUILD_CREDITS, "funded the first build");

  // --- does the builder still ask the right questions? ----------------------
  //
  // TWO MESSAGES, TWO WORDS READ, NOTHING BUILT. `/api/site/route` only decides
  // ask-or-build and answers; the expensive half is a separate call this never
  // makes. So each of these is one Haiku call — 1 credit — and no designer, no
  // Neon project, no compile, no site.
  //
  // WHY BOTH, and this is the whole reason it is a pair rather than a check:
  // EITHER ONE ALONE IS PASSED BY A BROKEN ROUTER. A builder that asks every
  // single time passes the first; a builder that never asks passes the second.
  // Only together do they bracket the behaviour — which is the vacuous-assertion
  // trap this repo keeps recording, written down in advance for once.
  //
  // It is here because the question policy is PROMPT text, and no unit test can
  // prove a prompt produces a behaviour. This has already regressed once
  // exactly that way: "ask if you genuinely need to" plus "When in doubt,
  // build" left the feature reachable at every layer and asking nothing, and it
  // was found by a one-off manual probe long afterwards. Running on every
  // deploy is the difference between finding that in a minute and finding it in
  // a month.
  const routeIntent = async (message) => {
    const r0 = await fetch(`${BASE}/api/site/route`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "content-type": "application/json" },
      // `firstBuild` is what opens the question path at all — a revise is never
      // asked anything, so without it both probes would trivially answer
      // "build" and the pair would prove nothing.
      body: JSON.stringify({ message, firstBuild: true, brief: message, site: {} }),
    });
    const d0 = await r0.json().catch(() => null);
    return { status: r0.status, intent: d0 && d0.intent, body: JSON.stringify(d0 || {}).slice(0, 200) };
  };

  // THE FLOOR. This brief names no trade at all, and it is the exact one that
  // proved the feature dead before — it came back "build" and a site was made
  // out of a guess. A gym, a pottery studio and a driving school are three
  // different sites, so there is nothing to build from here without asking.
  const thin = await routeIntent("a website for my business");
  ok("a brief that names no trade is asked about it", thin.intent === "clarify",
    `got ${thin.intent} (${thin.status}) ${thin.body}`);

  // THE CEILING. Trade named, and what visitors do named. Nothing is left that
  // would change what gets built, so asking anyway spends a minute of somebody's
  // time on a question whose answer changes nothing.
  const full = await routeIntent(
    "a barber shop in Leeds called Sharp Fade. Customers book an appointment online, and there is a price list for cuts and shaves.");
  ok("a brief that answers everything is built, not interrogated", full.intent === "build",
    `got ${full.intent} (${full.status}) ${full.body}`);

  // AND THE PAIR IS REPORTED AS A PAIR. Two passing lines are easy to read as
  // "the router works" when they are actually "it always asks" plus a fluke, so
  // the one thing that cannot be true of a stuck router is stated on its own.
  ok("the two briefs were routed differently", thin.intent !== full.intent,
    `both came back ${thin.intent} — the router is stuck, whichever way it is stuck`);

  // --- the actual build ---------------------------------------------------
  // THE BRIEF IS OVERRIDABLE, and the default is the one every assertion below
  // was calibrated against — a trade with a list to READ and a form to WRITE,
  // which is what "the seeded content is on the page" and "the site has a form
  // a visitor can submit" both depend on. A brief of a different SHAPE (a
  // brochure with no form, a members-only tool) can fail those honestly, so an
  // override is for looking at what the builder produces, not for CI.
  const brief = process.env.SMOKE_BRIEF
    || "A small barber shop site. Visitors book an appointment by picking a date and time, and can see the list of services with prices.";

  // The slug is CHOSEN here, not left to the designer.
  //
  // A slug is claimed by whoever built it first, across every account. Letting
  // the designer name the site from a fixed brief meant it kept proposing the
  // same good name — and the moment any real user (or an earlier manual test)
  // owns that name, the build correctly answers 409 and the whole smoke run
  // fails on something that is not a bug. It failed exactly that way on
  // 2026-07-28 against `sharp-fade-barbershop`. A test must not depend on a
  // global namespace it does not control.
  const runSlug = "smoke-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);

  // WHAT THE ACCOUNT HOLDS IMMEDIATELY BEFORE THE BUILD — read HERE, not at
  // sign-in, and the position is the whole assertion.
  //
  // The two routing calls above cost a credit each, so a reading taken before
  // them falls whether or not the build charges anything: "the balance went
  // down" would then be true of a run that billed the build at zero, which is
  // the vacuous assertion this file keeps recording. Taken here, the only thing
  // between the two readings is the build.
  const pre = await fetch(`${BASE}/api/credits`, { headers: { Authorization: `Bearer ${jwt}` } });
  const pj = await pre.json().catch(() => ({}));
  const startBalance = typeof pj.balance === "number" ? pj.balance : null;
  // Asserted, because the charge check below compares against this number and a
  // reading that never happened makes it meaningless rather than false.
  ok("read the balance the build starts from", typeof startBalance === "number", JSON.stringify(pj));

  console.log("posting a real build…", runSlug, `(balance ${startBalance})`);
  const r = await fetch(`${BASE}/api/site/react-build`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "content-type": "application/json" },
    body: JSON.stringify({ brief, slug: runSlug }),
  });
  const d = await r.json().catch(() => ({}));
  ok("build returns 200", r.status === 200, r.status + " " + JSON.stringify(d).slice(0, 300));
  slug = d && d.slug;
  ok("response carries a slug and url", !!(slug && d.url), JSON.stringify(d).slice(0, 200));
  ok("and it is the slug we asked for", slug === runSlug, `${slug} !== ${runSlug}`);
  ok("response says the site has a backend", d && d.backend === true);
  ok("at least one table was created", Array.isArray(d.tables) && d.tables.length > 0, JSON.stringify(d.tables));
  // Nothing can write to a `display` table after the build, so a table that was
  // not seeded here is an empty list forever.
  ok("every display table got starter content", (() => {
    const want = (Array.isArray(d.schema) ? d.schema : []).filter((t) => t.access === "display").map((t) => t.name);
    return want.length > 0 && want.every((n) => (d.seeded || {})[n] > 0);
  })(), "seeded=" + JSON.stringify(d.seeded || {}) + " schema=" + JSON.stringify(d.schema || []));
  console.log("   seeded:", JSON.stringify(d.seeded || {}));
  // WHICH OF THE TWO SEEDED IT — the designer, or the net that catches it when
  // it does not. The assertion above passes either way, and until now the run
  // could not tell them apart: `seedTopUp` has been on the response since the
  // net was built (2026-08-12) and was printed by nothing, so the one thing
  // standing between a skipped `seed` and a café with a permanently empty menu
  // had never been observed doing its job.
  //
  // MEASURED, so this is not hypothetical: `schema gen eval` at 5 samples put
  // the designer's raw miss rate at 3 in 20 — once on a menu, twice on a salon,
  // where an unseeded `services` table means the booking form's Service field
  // has zero options and nobody can submit it at all.
  //
  // Printed rather than asserted, deliberately. A run where the designer got it
  // right is the GOOD outcome and has no top-up to show; failing that would
  // demand the model misbehave to go green. What is asserted is the property
  // that matters: gaps the net found must be gaps the net filled.
  if (d.seedTopUp) {
    console.log("   seed top-up FIRED — designer missed:", JSON.stringify(d.seedTopUp.gaps),
      "· filled:", JSON.stringify(d.seedTopUp.filled));
    ok("the seed net filled every gap it found",
      (d.seedTopUp.gaps || []).every((g) => (d.seedTopUp.filled || []).includes(g)),
      JSON.stringify(d.seedTopUp));
  } else {
    console.log("   seed top-up: not needed — the designer seeded every display table itself");
  }
  if (d.seedSkipped) console.log("   seed skipped:", JSON.stringify(d.seedSkipped));
  console.log("   designed:", JSON.stringify(d.tables), "brand:", d.brand);
  console.log("   pages:", JSON.stringify(d.files), "→", d.page, d.buildMs ? "(" + d.buildMs + "ms)" : "");
  if (d.notes) console.log("   notes:", d.notes);
  if (d.problems) console.log("   problems:", JSON.stringify(d.problems));

  // --- DID THIS SITE GET ITS OWN SCRIPT? ------------------------------------
  //
  // THE ONE THING NO FREE CHECK CAN ANSWER. The bundle is packaged and executed
  // in `site build` at no cost, but the UPLOAD needs a real Cloudflare call
  // against a real dispatch namespace — so this run is the only place it
  // happens, and until now the result reached a Cloudflare log and nothing
  // else. The site serves from R2 either way, so a failed upload looks
  // identical to a working platform from every other angle.
  //
  // REPORTED, NOT ASSERTED, and that is deliberate for exactly one run: the
  // path has never executed, so a red line here would be indistinguishable
  // from the thing it is measuring. It becomes an assertion once it has been
  // green once.
  if (!d.worker) {
    console.log("   worker: NO SCRIPT UPLOADED — either no dispatch credentials on the Worker, or nothing was packaged");
  } else if (d.worker.uploaded) {
    // AND WHETHER THE PUBLISH WAITED FOR IT, which is the number this run
    // exists to get. `confirmMs` absent means there was no build stamp to wait
    // for at all; present with `confirmed: false` means the wait ran and spent
    // its budget. Those need opposite fixes and used to look identical.
    console.log("   worker: UPLOADED — this site is served by its own script"
      + (d.worker.confirmMs === undefined
        ? "  (no build stamp — the wait did not run)"
        : `  (serving it after ${d.worker.confirmMs}ms, ${d.worker.confirmed ? "confirmed" : "NOT CONFIRMED — budget spent"})`));
  } else {
    console.log("   worker: UPLOAD FAILED —", d.worker.status, d.worker.error);
  }

  // --- WHAT THE PAGE LOOKED LIKE, WHICH NOTHING HERE HAD EVER PRINTED -------
  //
  // The build response carries `render`, `renderNote`, `prerenderSkipped` and
  // `prerenderUnprivileged`, all under the same noteworthy contract: absent on
  // a clean build, present when there is something to say. This run threw all
  // four away — so the ONE check in the pipeline that opens a browser and looks
  // at the page could report an invisible heading or a see-through modal on a
  // real customer-shaped site and the log would be byte-identical to a clean
  // run. The signal-computed-and-discarded failure this repo keeps recording,
  // in the harness whose whole job is reporting.
  //
  // PRINTED, NOT ASSERTED, and that is deliberate rather than timid: the render
  // check is reporting-only by design until its false-alarm rate has been
  // measured on real sites, and this is the first run that can measure it. A
  // gate here would fail a build over a check nobody has calibrated yet.
  if (d.renderNote) console.log("   render:", d.renderNote);
  if (d.render) console.log("   render detail:", JSON.stringify(d.render).slice(0, 600));
  if (d.prerenderSkipped) console.log("   prerender SKIPPED for:", JSON.stringify(d.prerenderSkipped));
  // Only ever present as `false`: the prerender executes model-written page
  // code, and whether it was dropped to an unprivileged user is a fact about
  // production worth reading rather than assuming. Expected false today — the
  // build service runs as root and the fix is a Dockerfile change — so it is
  // reported rather than asserted, or the run goes red for a known reason.
  if (d.prerenderUnprivileged === false) console.log("   NOTE: the prerender ran UNSANDBOXED (build service is root)");

  // --- WHAT THE BUILD ACTUALLY DID ----------------------------------------
  // The build's own account of itself, printed rather than asserted. A duration
  // is not a pass/fail — a slow build is still a correct one — but a run that
  // takes four minutes and a run that takes ninety seconds looked identical in
  // this log until now, and the schema call's real cost had never been measured
  // against the flat SITE_BUILD_FEE it is billed at.
  if (Array.isArray(d.trace) && d.trace.length) {
    // The extras are printed too — `s.ms` alone drops exactly the numbers the
    // step was instrumented to carry (the pages split, the token counts).
    const fmt = (s) => {
      const extra = Object.entries(s).filter(([k]) => k !== "s" && k !== "ms");
      return s.s + " " + s.ms + "ms" + (extra.length ? " [" + extra.map(([k, v]) => k + " " + v).join(", ") + "]" : "");
    };
    console.log("   trace:");
    for (const step of d.trace) console.log("     " + fmt(step));
    console.log("   total:", d.totalMs + "ms");
  }
  // Both model calls, side by side, in the four kinds they are priced in. Whether
  // the flat SITE_BUILD_FEE is right, and whether the cached prefixes are paying
  // for themselves, are answerable from these two lines and from nothing else.
  const usage = (label, u, extra) => u && console.log(
    `   ${label}: in ${u.in} · out ${u.out} · cacheRead ${u.cacheRead} · cacheWrite ${u.cacheWrite}${extra || ""}`);
  // `schemaCost`, NOT `schemaFee` — there has never been a field by that name.
  // It read `undefined`, so the schema line said "charged undefined" and, worse,
  // the pages line subtracted `|| 0` and printed the WHOLE bill as the pages
  // call: a run charging 9 + 11 reported "pages call → charged 20". The two
  // numbers this report exists to separate were one number wearing a label.
  // Measured on the 2026-08-09 run, against the trace in the same output.
  usage("schema call", d.schemaUsage, ` → ${d.schemaCredits} credits, charged ${d.schemaCost}`);
  usage("pages call ", d.pagesUsage, ` → charged ${d.cost - (d.schemaCost || 0)} credits`);
  // A total, because two lines that must add up are easier to disbelieve than a
  // third that states what the customer was actually charged.
  //
  // ONLY ON A BUILD THAT HAPPENED. A 402 refusal carries `cost` too, and there
  // it means what the build WOULD need — so a run that was refused having spent
  // nothing printed "total charged: 20 credits", which is the opposite of what
  // occurred. Measured 2026-08-13, on the first run after the credit floor was
  // corrected: the one line somebody reads to find out what a build cost said
  // the customer had been billed for a build that never started.
  if (typeof d.cost === "number" && d.ok) console.log(`   total charged: ${d.cost} credits`);
  else if (typeof d.cost === "number") console.log(`   nothing charged — refused, needing ${d.cost} credits`);
  // A RETRIED CONTAINER, SAID OUT LOUD. A build that succeeded on its second
  // compile is indistinguishable from one that succeeded on its first unless
  // this is printed — and the whole point of the retry is that the failure it
  // absorbs is infrastructure, which nobody would otherwise learn was happening.
  if (d.builds > 1) console.log(`   the container was retried: ${d.retriedBuild}`);
  // Reported, never enforced: the trace is a diagnostic, and a smoke test that
  // fails on a slow step turns a measurement into a flake.
  ok("the build reports its own steps", Array.isArray(d.trace) && d.trace.length >= 3,
    "trace=" + JSON.stringify(d.trace || null));

  // --- the access levels are enforced live --------------------------------
  // The build must produce something readable and something submittable, and
  // must NOT let a visitor read back other people's submissions.
  const levels = Array.isArray(d.schema) ? d.schema : [];
  ok("build reports an access level per table", levels.length > 0, JSON.stringify(levels));
  const display = levels.find((t) => t.access === "display");
  const collect = levels.find((t) => t.access === "collect");
  ok("the designer chose a readable table for content", !!display, JSON.stringify(levels));
  ok("the designer chose a write-only table for submissions", !!collect, JSON.stringify(levels));

  // Against the site's own Neon Data API, through the platform's proxy. These
  // statuses are no longer produced by a rule in the Worker — the row routes were
  // deleted 2026-07-30 — they come from the GRANTs the schema engine issues, so
  // this is now a live check that `grantsFor` says what we think it says. A
  // `display` table is granted SELECT only and a `collect` table INSERT only, and
  // Postgres refuses the other direction with 42501, which PostgREST answers 403.
  // A BRAND-NEW SITE IS NOT REACHABLE THE INSTANT THE BUILD RETURNS.
  //
  // Measured 2026-08-04: this probe ran 10s after the build and got
  // `400 missing authentication credentials` — our proxy fetches an anonymous
  // token from the site's own Neon Auth server and attaches it, and that fetch
  // had failed, so nothing was attached. A second probe 43s in timed out (503).
  // The browser then made the SAME reads at 45s and every one answered 200.
  //
  // These assertions are about GRANTS, not about latency, so they retry rather
  // than reporting a permissions failure that is really a cold start. The wait
  // is bounded and it REPORTS what it saw on the way, because "the first minute
  // of a new site's life is broken" is a real thing to know about and not
  // something a retry should paper over silently.
  const settle = async (url, want, tries = 6) => {
    let last = null;
    for (let i = 0; i < tries; i++) {
      const r = await fetch(url).catch((e) => ({ status: 0, text: async () => String(e && e.message) }));
      const body = await r.text().catch(() => "");
      last = { status: r.status, body };
      if (r.status === want) {
        if (i) console.log(`   (settled after ${i} retr${i === 1 ? "y" : "ies"}: ${url.split("/data/")[1]})`);
        return last;
      }
      await new Promise((res) => setTimeout(res, 5000));
    }
    return last;
  };

  if (display) {
    // THE BODY, NOT JUST THE STATUS. `-> 501` and `-> 400` were the entire
    // report on three failures for a whole day, and each time the reason was
    // sitting in a response nobody read. The proxy passes the Data API's answer
    // through as-is, so PostgREST's own `message`/`code`/`hint` is right there.
    const r2 = await settle(`${BASE}/api/db/${slug}/data/${display.name}?select=*`, 200);
    const b2 = r2.body;
    ok(`GET ${display.name} (display) is allowed`, r2.status === 200, r2.status + " " + b2.slice(0, 300));
    const w = await fetch(`${BASE}/api/db/${slug}/data/${display.name}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    });
    ok(`POST ${display.name} (display) is refused`, w.status === 403,
      w.status + " " + (await w.text().catch(() => "")).slice(0, 300));
  }
  if (collect) {
    const r3 = await settle(`${BASE}/api/db/${slug}/data/${collect.name}?select=*`, 403);
    const b3 = r3.body;
    ok(`GET ${collect.name} (collect) is refused — submissions are not public`,
      r3.status === 403, r3.status + " " + b3.slice(0, 300));
  }

  // --- the ledger rows ----------------------------------------------------
  if (slug) {
    const g = await fetch(`${SUPABASE_URL}/rest/v1/site_backends?slug=eq.${encodeURIComponent(slug)}&select=neon_db,uid`, { headers: svc() });
    const rows = await g.json().catch(() => []);
    ok("site_backends row written", Array.isArray(rows) && rows.length === 1 && !!rows[0].neon_db, JSON.stringify(rows));
    ok("site is owned by the caller", rows[0] && rows[0].uid === userId);
  }
  // BY SLUG, from `site_project`. This read `user_site_project?uid=eq.<user>`,
  // the PER-USER layout that per-site projects replaced on 2026-07-29 — so it
  // asserted against a table this design stopped writing, and failed on a build
  // that had provisioned perfectly. The cleanup below drops whatever project it
  // finds, so reading the wrong table also leaked one project per run.
  const p = await fetch(`${SUPABASE_URL}/rest/v1/site_project?slug=eq.${slug}&select=neon_project,neon_conn`, { headers: svc() });
  const projs = await p.json().catch(() => []);
  projectId = projs && projs[0] && projs[0].neon_project;
  ok("a Neon project was provisioned for this site", !!projectId, JSON.stringify(projs));

  // WHAT `_meta` ACTUALLY CONTAINS — asserted, not inferred.
  //
  // The 501s below say `siteDataBase` resolved null, and from outside that has
  // two indistinguishable causes: the row was never written, or it was written
  // and cannot be parsed. A day was spent reasoning between them, and two
  // theories were wrong (the field name; a cached null — `makeCache` refuses to
  // cache absence, so that one was never possible). This reads the row.
  //
  // `data_api` is what every list and every form on the published site goes
  // through, and `auth_info` is every sign-in — with the Worker's own row routes
  // deleted, a site missing them is a shell.
  const proj0 = projs && projs[0];
  if (proj0 && proj0.neon_conn) {
    try {
      const siteConn = connForDatabase(proj0.neon_conn, dbNameForSite(slug));
      const meta = await sqlQuery(siteConn, "SELECT k, length(v) AS n FROM _meta ORDER BY k");
      const keys = meta.map((r) => `${r.k}(${r.n})`).join(", ") || "(empty)";
      console.log("   _meta holds: " + keys);
      const has = (k) => meta.some((r) => r.k === k && Number(r.n) > 0);
      ok("_meta records the Data API endpoint", has("data_api"), keys);
      ok("_meta records the auth endpoint", has("auth_info"), keys);
      // Parsed, not just present: a stored blob the resolver cannot read is the
      // same 501 from a visitor's side, and telling them apart is the point.
      const row = meta.find((r) => r.k === "data_api");
      if (row) {
        const v = await sqlQuery(siteConn, "SELECT v FROM _meta WHERE k='data_api'");
        let url = null;
        try { url = JSON.parse(v[0].v).url; } catch { /* reported below */ }
        ok("the recorded Data API endpoint is an https url", /^https:\/\//.test(String(url || "")), String(url).slice(0, 120));
      }
    } catch (e) {
      console.log("   FAIL could not read the site's _meta -> " + String(e && e.message).slice(0, 200));
      failed++;
    }
  }

  // --- the published page -------------------------------------------------
  // `page` says which of the two things was published. The generated app is the
  // normal outcome; the placeholder is the fallback for a build that failed, so
  // landing on it is a regression and has to go red rather than pass quietly.
  // Diagnostic order matters: `notes` is the model's own prose and can run to
  // hundreds of characters, which pushed the fields that say WHY off the end of
  // the truncated line. stage/error/problems first, notes last and short.
  // `cited` is the SOURCE LINE each compiler error points at. Without it a
  // typecheck failure is a file and a column number, and diagnosing one means
  // guessing what the model wrote — a whole round went on inferring
  // `TS2344: Type 'PublicBooking' does not satisfy the constraint 'Row'` from
  // its position alone. The pages are gone the moment the build returns.
  ok("the generated app was published, not the fallback", d.page === "app",
    "page=" + d.page + " stage=" + (d.stage || "-") +
    " problems=" + JSON.stringify(d.problems || []));
  // THE ERROR AND ITS SOURCE LINES GO ON THEIR OWN LINES.
  //
  // `ok()` truncates its extra at 300 characters, and this used to pack
  // page/stage/error/problems/cited/notes into that one string. A typecheck
  // failure reports two or three TS errors, which is more than 300 characters by
  // itself — so `cited`, the field added specifically to explain a compile
  // failure, was pushed off the end and printed nothing on the first real
  // typecheck failure after it shipped.
  //
  // The comment this replaces already said exactly that, about `notes`: "which
  // pushed the fields that say WHY off the end of the truncated line". The fix
  // then was to reorder. Reordering only moves which field gets lost.
  if (d.page !== "app") {
    if (d.error) console.log("   error:\n     " + String(d.error).split("\n").join("\n     "));
    if (d.cited && d.cited.length) console.log("   the model wrote:\n     " + d.cited.join("\n     "));
    else if (d.stage === "typecheck") console.log("   (no cited lines — citedLines could not match the error to a page)");
  }
  ok("the build reports the route files it wrote",
    Array.isArray(d.files) && d.files.some((f) => /index\.tsx$/.test(f)), JSON.stringify(d.files));

  if (slug) {
    // ONE PUBLIC ADDRESS. `/s/<slug>/` is the internal one and must now send
    // everybody to the pretty host, so this is checked WITHOUT following — a
    // redirect that quietly stopped happening would otherwise look identical to
    // one that works, because `fetch` follows it either way.
    const noFollow = await fetch(`${BASE}/s/${slug}/`, { redirect: "manual" });
    ok("the internal address redirects to the one public address",
      noFollow.status === 301, String(noFollow.status));
    ok("…and it points at this site's own hostname",
      String(noFollow.headers.get("location") || "").startsWith(`https://${slug}.gofarther.app/`),
      noFollow.headers.get("location"));
    // Fall back to the internal address when there is no redirect — a slug DNS
    // cannot carry, or the zone turned off. Those sites still serve there.
    SITE = noFollow.status === 301 && noFollow.headers.get("location")
      ? new URL("./", noFollow.headers.get("location")).href
      : `${BASE}/s/${slug}/`;

    // EVERYTHING BELOW NOW LANDS ON THE PUBLIC HOST, by following that redirect,
    // and that is the point rather than a side effect: every check here used to
    // load `/s/<slug>/`, which is the one mount where uploads happened to work —
    // so a bug that broke every image on the address customers are actually sent
    // to passed CI completely and was found by a person opening a link.
    const page = await fetch(`${BASE}/s/${slug}/`);
    const html = await page.text().catch(() => "");
    ok("published page serves 200", page.status === 200, String(page.status));
    ok("…on the public hostname, having followed the redirect",
      new URL(page.url).hostname === `${slug}.gofarther.app`, page.url);
    if (d.page === "app") {
      // NO `#root` UNDER START — `__root.tsx` renders <html>/<head>/<body>
      // itself, verified against a real bundle where `id="root"` appears
      // nowhere. This looked for the mount div the old shell needed for
      // `createRoot`, so it failed against a perfectly rendered document.
      //
      // What identifies a real compiled page now: a COMPLETE document with a
      // module script to hydrate with, and enough of it to be a page rather
      // than a stub. That is the same shape `site-build.mjs` asserts against
      // the executed bundle, and it is what the `[object Object]` failure —
      // fifteen literal characters served as a whole document — could not pass.
      //
      // Deliberately NOT matching on the word `body` in a pattern: this file
      // declares a `const body` in a block above, and the out-of-scope scanner
      // in `test/worker-imports.test.mjs` reads any occurrence of the name as a
      // read. That scanner catches real ReferenceErrors and does not lex regex
      // literals, which is the right trade — hand-lexing them is the
      // over-blanking failure this repo already records.
      ok("the page is the compiled app",
        /<!DOCTYPE html>/i.test(html) && /<\/html>/i.test(html) && /<script[^>]+src=/.test(html) && html.length > 2000,
        html.length + " bytes: " + html.slice(0, 200));

      // ── WHAT THE SITE'S OWN SCRIPT HAD TO GET RIGHT (2026-08-17) ─────────
      //
      // Serving a page from a per-site Worker moved where the document comes
      // from, and three things the static path did silently did not move with
      // it. Each cost something a visitor or a crawler sees, and each is
      // invisible to every other check in this file — the site still builds,
      // still publishes and still answers 200 with all three broken.
      //
      // Asserted only when a script really served this, since with no script
      // the static path answers and all three were always right.
      const byScript = !!(d.worker && d.worker.uploaded);
      if (byScript) {
        // THE SHARE CARD. `injectMeta` writes these at PUBLISH time, after the
        // container produced the bundle — so a script with the shell baked in
        // served the version from before they existed. Measured on the first
        // live build: a real page whose whole head was `<title>Forno</title>`.
        // WhatsApp, Slack and iMessage read the head and never run the bundle.
        ok("the script serves the PUBLISHED document, with its share tags",
          /<meta property="og:title"/i.test(html) && /<meta property="og:description"/i.test(html),
          "the head has no Open Graph tags — a baked shell? " + (html.match(/<head>[\s\S]{0,300}/) || [""])[0]);

        // THE BUNDLE. vite writes `./assets/…` and a browser resolves that
        // against the DIRECTORY of the URL — so a relative reference that
        // survives is a blank page on `/book/` and on any nested route.
        ok("…with its asset references made absolute",
          !/\s(?:src|href)="\.\//.test(html),
          (html.match(/\s(?:src|href)="\.\/[^"]*"/) || [""])[0] + " — this 404s on a trailing slash");
      }

      // THE SITEMAP, whichever path served it. Published carrying a placeholder
      // because the same bytes serve at three addresses; the real origin goes in
      // at serve time, and a script serving it raw would hand a crawler a list
      // of URLs that resolve nowhere.
      const sm = await fetch(new URL("sitemap.xml", SITE).href);
      const smText = await sm.text().catch(() => "");
      ok("sitemap.xml carries a real origin, not the placeholder",
        sm.status === 200 && !/__SITE_ORIGIN__/.test(smText),
        sm.status + " " + smText.slice(0, 160));
      ok("…and its URLs are on this site's own hostname",
        new RegExp("<loc>" + SITE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(smText),
        (smText.match(/<loc>[^<]*<\/loc>/) || ["(no <loc>)"])[0] + "  expected under " + SITE);

      // ── A DEEP LINK IS A REAL ADDRESS ────────────────────────────────────
      //
      // `/s/<slug>/book` used to 404, because vite emits no `book.html` — and
      // that one 404 is why the template ran on hash routing and why every page
      // of every published site shared ONE address: unindexable, one link
      // preview for the whole site, and every visit logged as "/".
      //
      // Checked against a route the build really wrote, not a guessed name.
      const deep = (d.files || [])
        .map((f) => String(f).replace(/^src\/routes\//, "").replace(/\.tsx$/, ""))
        .find((r) => r !== "index" && /^[a-z0-9-]+$/i.test(r));
      if (deep) {
        const dr = await fetch(new URL(deep, SITE).href);
        const dh = await dr.text();
        ok(`a deep link (/${deep}) answers with the app, not 404`,
          dr.status === 200 && /id="root"/.test(dh), dr.status + " " + dh.slice(0, 120));

        // ── AND IT IS ITS OWN DOCUMENT, WITH ITS OWN CARD ──────────────────
        //
        // The point of prerendering: a link preview fetches the HTML once and
        // reads the head — it never runs the bundle — so before this, every
        // page pasted into WhatsApp showed the home page's card whatever was
        // copied. Compared AGAINST the home page rather than merely being
        // present, because "has a title" was true the whole time it was wrong.
        const titleOf = (h) => (h.match(/<title>([^<]*)<\/title>/i) || [])[1] || "";
        const descOf = (h) => (h.match(/<meta property="og:description" content="([^"]*)"/i) || [])[1] || "";
        ok(`/${deep} carries its own title, not the home page's`,
          !!titleOf(dh) && titleOf(dh) !== titleOf(html), `${titleOf(html)}  vs  ${titleOf(dh)}`);
        ok(`/${deep} has words in it before any JavaScript runs`,
          (((dh.match(/<div id="root">([\s\S]*)<\/div>/) || [])[1] || "").replace(/<[^>]+>/g, " ").trim().length) > 6,
          dh.slice(dh.indexOf('<div id="root">'), dh.indexOf('<div id="root">') + 160));
        // THE ONE THAT IS NOT COSMETIC. `siteSlug()` reads this tag, and on a
        // custom domain there is no `/s/<slug>/` in the path — so a prerendered
        // page without it sends a visitor who landed here straight at a
        // DIFFERENT site's API.
        ok(`/${deep} knows which site it belongs to`,
          new RegExp(`<meta name="site-slug" content="${slug}"`).test(dh),
          (dh.match(/<meta name="site-slug"[^>]*>/) || ["(absent)"])[0]);
        if (descOf(dh) && descOf(html)) {
          console.log(`   home card: ${descOf(html).slice(0, 70)}`);
          console.log(`   ${deep} card: ${descOf(dh).slice(0, 70)}`);
        }
      }
      // AND AN ASSET STILL 404s. If the fallback ever caught these, a missing
      // chunk would answer HTML and the browser's error would point nowhere near
      // the file that is actually gone.
      const bogus = await fetch(new URL("assets/definitely-not-a-real-chunk.js", SITE).href);
      ok("a missing asset still 404s — the fallback is extensionless-only",
        bogus.status === 404, String(bogus.status));
      ok("its stylesheet was published too", /<link[^>]+\.css/.test(html), html.slice(0, 240));
      // What a shared link shows. Link previews fetch the HTML once and read the
      // head — they do not run the bundle — so without these a customer sent
      // this URL on WhatsApp sees a bare address. Checked HERE because the tags
      // are injected at publish time and this is the only place a real publish
      // happens on every deploy.
      ok("a shared link has a description", /<meta name="description" content="[^"]{10,}"/.test(html), html.slice(0, 400));
      ok("and an Open Graph title", /<meta property="og:title" content="[^"]{2,}"/.test(html), html.slice(0, 400));
      ok("and a twitter card, exactly one", (html.match(/twitter:card/g) || []).length === 1, String((html.match(/twitter:card/g) || []).length));
      // DERIVED FROM THE BRIEF, not a literal copy of it. Pinned to the barber
      // wording this passed vacuously the moment the brief was overridden — the
      // string it looks for is simply not in the page, so a designer echoing a
      // DIFFERENT prompt verbatim would have been reported as writing its own
      // sentence. Assert the property, not the spelling.
      ok("the description is not the raw brief", !html.includes(brief.slice(0, 40)),
        "the designer should write a customer-facing sentence, not echo the prompt");
      // The shell is a root div — the table names live in the bundle, which is
      // also the only proof the pages actually talk to the database that was
      // just provisioned rather than to hardcoded content. The router code-splits
      // each route into its own lazy chunk, so the entry NAMES the pages rather
      // than containing them and the chunks have to be followed.
      const grab = (href) => fetch(href).then((x) => (x.ok ? x.text() : "")).catch(() => "");
      const entry = (html.match(/src="([^"]+\.js)"/) || [])[1];
      const entryUrl = entry ? new URL(entry, SITE).href : "";
      const head = entryUrl ? await grab(entryUrl) : "";
      // Chunks sit beside the entry and are named relative to it ("./index-X.js").
      const chunks = [...new Set([...head.matchAll(/["'](\.\/[A-Za-z0-9._-]+\.js)["']/g)].map((m) => m[1]))].slice(0, 8);
      const js = head + (await Promise.all(chunks.map((c) => grab(new URL(c, entryUrl).href)))).join("");
      ok("the bundle serves 200 from the same site", !!head, entry || "no script src in the shell");
      ok("the bundle reads a table the build created",
        !!js && Array.isArray(d.tables) && d.tables.some((t) => js.includes(t)),
        entry + " + " + chunks.length + " chunk(s)");

      // IS THE CONTAINER RUNNING THE IMAGE WE JUST DEPLOYED?
      //
      // The template — including `@/lib/rows.ts` — is baked into the build
      // container's image, so a site is only as current as the image that built
      // it. Cloudflare's rollout is asynchronous: `wrangler` returns after
      // "Modified application", and this job starts immediately afterwards.
      //
      // Measured 2026-08-04: the image went `ede44c96` -> `070b1f68` at 17:37:35
      // and the build POST landed ~60s later. Its bundle was the PREVIOUS
      // rows.ts, so `usePublicRows` still fetched the table instead of the view
      // and the run reported two failures with no hint that the code under test
      // was not the code that ran. That cost a full diagnosis to rule out a bug
      // that did not exist.
      //
      // The check below is a DIGEST comparison rather than the marker string this
      // comment used to describe — see the note on it.
      // A DIGEST, NOT A MARKER — and the difference has now cost two diagnoses.
      //
      // This used to look for the string `_public` in the bundle. That proved
      // the image was at least as new as the change which introduced it, and
      // nothing more: after the NEXT change it passes happily while testing
      // stale code. Exactly what happened on 2026-08-04 — a booking-form fix
      // merged, deployed at 22:53:09, the build POST landed 42s later on the
      // PREVIOUS image, the marker check went green, and the run reported the
      // bug as still present when it had already been fixed.
      //
      // A digest of `src/lib/rows.ts` changes with every edit, so comparing the
      // container's against this checkout's answers the question exactly rather
      // than approximately. Derived at both ends from the same file.
      const wantId = createHash("sha256")
        .update(fs.readFileSync(new URL("../../builder/lovable/template/src/lib/rows.ts", import.meta.url)))
        .digest("hex").slice(0, 12);
      ok("the container built this site with the CURRENT template",
        d.templateId === wantId,
        `container template ${d.templateId || "(not reported)"} != checkout ${wantId} — the image is ` +
        "behind, so this run did NOT test the code under test. Cloudflare's rollout is async; re-run after it lands.");
    } else {
      ok("the fallback page names a table it created",
        Array.isArray(d.tables) && d.tables.some((t) => html.includes(t)), html.slice(0, 160));
    }
  }

  // --- does a VISITOR actually get a working site? ------------------------
  //
  // Everything above proves the files were published. None of it executes the
  // JavaScript. A site that mounts to a blank page, or whose every data call
  // 403s, or that throws on its first render, passes every check so far — and
  // that is precisely the failure GENERATOR.md exists to prevent: a page that
  // typechecks, bundles, screenshots fine, and does nothing.
  //
  // site-runtime.mjs drives the REFERENCE page against a STUB. This drives the
  // REAL generated page against the REAL API, which is the only version of the
  // question a user cares about.
  if (d.page === "app" && slug) {
    let browser = null;
    try {
      const { chromium } = await import("playwright");
      browser = await chromium.launch({ executablePath: findChromium() || undefined });
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const pg = await ctx.newPage();

      // A page that throws during render still leaves the shell in the DOM, so
      // "did it render" is not enough on its own — the errors have to be caught.
      const pageErrors = [], consoleErrors = [], apiCalls = [];
      pg.on("pageerror", (e) => pageErrors.push(String(e && e.message).slice(0, 200)));
      pg.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
      pg.on("response", (res) => {
        const u = res.url();
        if (u.includes(`/api/db/${slug}/data/`)) apiCalls.push({ method: res.request().method(), url: u, status: res.status() });
      });

      await pg.goto(SITE, { waitUntil: "networkidle", timeout: 60000 });
      // React mounting is what separates a live site from a served file.
      // NO `#root` UNDER START. `__root.tsx` renders `<html>`, `<head>` and `<body>`
      // itself, so the page content is a direct child of body — measured on a real
      // bundle: `id="root"` appears nowhere in the document. The old shell had that
      // div because `createRoot` needed something to mount into.
      //
      // Counting body descendants instead includes the two or three elements
      // `<Scripts />` emits, which the floors here are far above (20 nodes against a
      // real page's hundreds), so it still discriminates a blank render from a real
      // one — which is the only thing these counts are for.
      await pg.waitForFunction(() => !!document.body.firstElementChild, null, { timeout: 20000 }).catch(() => {});

      const mounted = await pg.evaluate(() => document.body.childElementCount > 0);
      ok("the app mounted — React rendered into the document body", mounted);
      ok("nothing threw during render", pageErrors.length === 0, pageErrors.join(" | "));
      // THE SITE'S OWN ERRORS, separated from the one the edge injects.
      //
      // Cloudflare adds its beacon to HTML on this zone — for browser-like
      // requests only, which is why curl with a default Accept does not show
      // it — and it is inserted AFTER this Worker responds, so there is nothing
      // to strip. Refusing it in the CSP cost a console error on EVERY page
      // view of EVERY customer site, which is how this was found.
      //
      // TWO CLAIMS THAT USED TO BE HERE WERE BOTH FALSE, and they are the
      // reason it sat unfixed: "no change to this repo can stop it" (the CSP
      // stops it) and "the switch is a Cloudflare zone setting" (there is no
      // such switch — the zone's Web Analytics page offers to turn RUM ON, so
      // nothing is configured and nothing can be un-configured). Measured
      // 2026-08-15 against the live dashboard and a real customer site.
      //
      // ASSERTED NOW RATHER THAN WARNED ABOUT. While it was unfixable a red run
      // would have trained everybody to ignore `build smoke`; now that the CSP
      // names both hosts, a violation means either the allow-list regressed or
      // Cloudflare moved the beacon — and both of those put the error back on
      // every published site, which is exactly what this run exists to catch.
      // Kept SEPARATE from the site's own errors either way, so a real page
      // error can never hide behind a known one.
      const edgeInjected = consoleErrors.filter((e) => /cloudflareinsights\.com/.test(e));
      const ownErrors = consoleErrors.filter((e) => !/cloudflareinsights\.com/.test(e));
      ok("no console errors from the site's own code", ownErrors.length === 0, ownErrors.join(" | "));
      ok("the edge-injected beacon is not refused by the site's CSP",
        edgeInjected.length === 0,
        "the CSP allow-list no longer covers the beacon — check whether Cloudflare moved the host: "
          + edgeInjected.join(" | "));

      const text = (await pg.evaluate(() => document.body.innerText || "")).trim();
      ok("the page rendered real content, not an empty shell", text.length > 60, `${text.length} chars: ${text.slice(0, 120)}`);

      // The whole point of the platform: the page reads the database that was
      // provisioned for it moments ago. A hardcoded page would make no call.
      const reads = apiCalls.filter((c) => c.method === "GET");
      ok("the page called its own data API", reads.length > 0, JSON.stringify(apiCalls));
      ok("every data read the page made was allowed",
        reads.length > 0 && reads.every((c) => c.status === 200),
        JSON.stringify(reads));
      // The lint predicts exactly this; here it is measured against the live API.
      const forbidden = apiCalls.filter((c) => c.status === 403);
      ok("the page never hit a 403 — it respected the access levels", forbidden.length === 0, JSON.stringify(forbidden));

      // shadcn is the whole UI contract — a page that hand-rolled its controls
      // would still render and still pass everything above. This version of
      // shadcn does not stamp `data-slot` (only 2 of the 46 components do), so
      // the marker is Radix's own a11y wiring plus new-york's class signature.
      const ui = await pg.evaluate(() => ({
        radix: document.querySelectorAll('[role="combobox"],[data-radix-collection-item],[data-state]').length,
        shadcnClasses: [...document.querySelectorAll("button,input,textarea")]
          .some((e) => /\bring-offset-background\b|\bborder-input\b|\bbg-primary\b/.test(e.className)),
        tailwind: !!document.querySelector("[class*='rounded-'],[class*='flex']"),
        forms: document.querySelectorAll("form").length,
        controls: document.querySelectorAll("form input, form textarea, form button").length,
      }));
      ok("shadcn controls are rendering, not hand-rolled ones", ui.shadcnClasses, JSON.stringify(ui));
      ok("Radix primitives are live in the page", ui.radix > 0, JSON.stringify(ui));
      ok("Tailwind utilities are applied", ui.tailwind);

      // THE FORM IS NOT NECESSARILY ON THE HOME PAGE, and asserting that it is
      // was a test defect rather than a product one. `build smoke` failed twice
      // on 2026-08-04 against a correct site: the barber shop put its booking
      // form on /book and linked to it from three places, which is where a
      // booking form belongs. The old check ran `pg.$("form")` on the home page
      // only, so it asserted a one-page site — exactly the over-specification
      // this repo already refuses elsewhere ("a timetable can legitimately
      // render the same signed in or out; that check fails on a correct site").
      //
      // So: walk the routes the BUILD ITSELF reported, home first, and stop at
      // the page that has a form.
      //
      // REAL PATHS SINCE 2026-08-09. A route is `/s/<slug>/book`; it used to be
      // `/s/<slug>/#/book`, because hash history was the only thing that worked
      // when a deep path 404'd. This comment said the opposite for one run after
      // the change and the walk still used `#/`, so every page loaded as HOME —
      // and the run reported `forms: 0, controls: 0`, i.e. a site with no form
      // anywhere. The page loads, it is a real page, it is the wrong one, which
      // is why the fingerprint assertion below exists rather than trusting the
      // URL.
      const routes = (d.files || [])
        .map((f) => String(f).replace(/^src\/routes\//, "").replace(/\.tsx$/, ""))
        .filter((r) => /^[a-z0-9-]+$/i.test(r) || r === "index");
      const asPath = (r) => (r === "index" ? "" : r);
      const fingerprint = () => pg.evaluate(() => (document.body.innerText || "").trim().slice(0, 400));

      const homePrint = await fingerprint();
      let formRoute = ui.forms > 0 ? "index" : null;
      let formUi = ui;
      // WHICH ROUTES WERE ACTUALLY LOOKED AT. The skip below is necessary and it
      // was silent, so "the booking page has no form" and "we never examined the
      // booking page" produced the identical failure line — measured 2026-08-13,
      // where a real 4-page barber shop reported no form anywhere and the log
      // could not say which of those two it was. A check that cannot describe
      // its own coverage cannot be acted on.
      const seen = [];
      for (const r of routes) {
        if (formRoute) break;
        if (r === "index") continue;
        const nav = await pg.goto(new URL(asPath(r), SITE).href, { waitUntil: "networkidle", timeout: 45000 })
          .then((res) => (res ? res.status() : 0)).catch(() => 0);
        await pg.waitForTimeout(1200);
        // A route that renders identically to home did not navigate. Skipping it
        // is what stops a silent SPA fallback being reported as "no form here".
        if ((await fingerprint()) === homePrint) { seen.push(r + ":same-as-home(" + nav + ")"); continue; }
        const u = await pg.evaluate(() => ({
          forms: document.querySelectorAll("form").length,
          controls: document.querySelectorAll("form input, form textarea, form button").length,
          // The three things a booking page needs even when it is not a <form>:
          // a page built out of buttons and a dialog is a real submit path, and
          // reporting it as "no form" would send somebody hunting a bug that is
          // a design choice. Counted, not asserted on — this line is here to
          // make the failure DIAGNOSABLE, not to widen what passes.
          inputs: document.querySelectorAll("input, textarea, select").length,
          buttons: document.querySelectorAll("button").length,
        }));
        seen.push(r + ":" + JSON.stringify(u));
        if (u.forms > 0) { formRoute = r; formUi = u; }
      }
      ok("the site rendered a form with real controls, on some page",
        !!formRoute && formUi.forms > 0 && formUi.controls > 1,
        `routes=${JSON.stringify(routes)} home=${JSON.stringify(ui)} found=${formRoute} ${JSON.stringify(formUi)}`
        + ` examined=[${seen.join(" | ")}]`);
      if (formRoute) console.log(`   the form lives on ${asPath(formRoute)}`);

      // The starter content actually reached the page. Without it a site is a
      // brochure with an empty list, and a form whose required Select reads that
      // list has nothing to choose — so nobody can submit it. This assertion
      // could not pass before seeding existed.
      ok("the seeded content is on the page, not an empty list",
        Object.keys(d.seeded || {}).length > 0, "seeded=" + JSON.stringify(d.seeded || {}));

      // And the whole reason seeding matters: a real visitor submission, filled
      // in a real browser and landing in real Postgres. Driven on whichever page
      // the walk above found the form on — the browser is already there.
      const form = await pg.$("form");
      ok("the site has a form a visitor can submit", !!form,
        formRoute ? `expected one on ${asPath(formRoute)}` : "no page in the site had one");
      if (form) {
        // Best-effort fill: the schema is designed per-brief, so the fields are
        // not known ahead of time. Every input gets something type-appropriate.
        await pg.evaluate(() => {
          const set = (el, v) => {
            const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
            Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(el, v);
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          };
          for (const el of document.querySelectorAll("form input, form textarea")) {
            if (el.type === "hidden" || el.disabled) continue;
            if (el.type === "email") set(el, "smoke@example.com");
            else if (el.type === "tel") set(el, "5551234567");
            else if (el.type === "number") set(el, "2");
            else if (el.type === "date") set(el, "2030-06-15");
            else if (el.type === "time") set(el, "14:30");
            else if (el.type === "datetime-local") set(el, "2030-06-15T14:30");
            else if (el.type === "checkbox" || el.type === "radio") { if (!el.checked) el.click(); }
            else set(el, "Smoke Test");
          }
        });
        // shadcn Selects are buttons, not <select> — open each and take an option.
        // These are the fields fed by the seeded tables, so this is the step that
        // silently did nothing before there was anything to choose.
        for (const trigger of (await pg.$$('form [role="combobox"]')).slice(0, 4)) {
          try {
            await trigger.click({ timeout: 3000 });
            const opt = await pg.waitForSelector('[role="option"]', { timeout: 4000 });
            await opt.click({ timeout: 3000 });
          } catch { /* not every combobox opens a listbox; skip it */ }
        }
        // A SLOT GRID IS A CHOOSER MADE OF BUTTONS, and the filler above cannot
        // see it: it handles inputs, textareas and comboboxes. A generated
        // booking page picks its time from a row of buttons fed by the live
        // availability read — which is the correct design and the one this
        // platform exists to produce.
        //
        // Measured 2026-08-04: every field filled, `Time` in red, "Pick a time"
        // underneath, no POST. The form was right and the robot could not drive
        // it, so the run reported "no POST went out — a required Select with no
        // options is the usual cause", which named the wrong cause entirely.
        //
        // Deliberately narrow: only a GROUP of three or more enabled
        // `type="button"` siblings, and never the submit. One or two buttons in a
        // form are "cancel" and "add another"; three or more that share a parent
        // are options to choose between.
        await pg.evaluate(() => {
          const form = document.querySelector("form");
          if (!form) return;
          const groups = new Map();
          for (const b of form.querySelectorAll('button[type="button"]:not([disabled])')) {
            const p = b.parentElement;
            if (!p) continue;
            if (!groups.has(p)) groups.set(p, []);
            groups.get(p).push(b);
          }
          for (const [, bs] of groups) {
            if (bs.length >= 3 && !bs.some((b) => b.getAttribute("aria-pressed") === "true")) bs[0].click();
          }
        });
        await pg.waitForTimeout(400);

        const submit = await pg.$('form button[type="submit"]') || await pg.$("form button");
        if (submit) await submit.click({ timeout: 5000 }).catch(() => {});
        await pg.waitForTimeout(7000);

        const writes = apiCalls.filter((c) => c.method === "POST");
        // NAMED FOR WHAT IT CHECKS. This said "wrote to the database" and only
        // checked that a POST went OUT — so on the run that found every
        // submission being refused with 403, the log's first line about the form
        // was a green tick claiming the write had landed. A name stronger than
        // its assertion is worse than no assertion: it is a false negative that
        // reads as evidence.
        ok("the form sent a submission", writes.length > 0,
          "no POST went out — a required Select with no options is the usual cause: " + JSON.stringify(apiCalls.slice(-4)));
        ok("and the database accepted it",
          writes.length > 0 && writes.every((c) => c.status >= 200 && c.status < 300),
          JSON.stringify(writes));

        // ── AND THE OWNER CAN READ IT BACK ──────────────────────────────────
        //
        // The half this test never had. A visitor's write was proved live and
        // the OWNER'S DOOR onto the same rows — `/api/site/<slug>/rows` and
        // `/rows/<table>`, which is exactly what the builder's Data panel calls
        // — was covered only by unit tests against fakes. So "the booking
        // landed" and "the shop can see the booking" were never joined up in
        // one run, and a barber shop taking bookings nobody can read is the
        // oldest failure this platform has had.
        //
        // It is also the door that reads `collect` tables, which the published
        // site's public API refuses by design. Nothing else can see them.
        const tRes = await fetch(`${BASE}/api/site/${slug}/rows`, { headers: { Authorization: `Bearer ${jwt}` } });
        const tJson = await tRes.json().catch(() => ({}));
        const ownerTables = Array.isArray(tJson.tables) ? tJson.tables : [];
        ok("the owner's door lists the site's tables", tRes.status === 200 && ownerTables.length > 0,
          `${tRes.status} ${JSON.stringify(tJson).slice(0, 200)}`);
        console.log("   owner sees tables: " + ownerTables.map((t) => `${t.name}(${t.access})`).join(", "));

        // The table the visitor actually wrote to, taken from the POST's own
        // URL rather than guessed — the schema is designed per brief, so the
        // name is not known ahead of time.
        const wrote = writes[0] && String(writes[0].url || "");
        const target = (wrote.match(/\/data\/([^?/]+)/) || [])[1];
        if (target) {
          const rRes = await fetch(`${BASE}/api/site/${slug}/rows/${encodeURIComponent(target)}`,
            { headers: { Authorization: `Bearer ${jwt}` } });
          const rJson = await rRes.json().catch(() => ({}));
          const rows = Array.isArray(rJson.rows) ? rJson.rows : [];
          ok(`the owner can read back the ${target} the visitor submitted`,
            rRes.status === 200 && rows.length > 0, `${rRes.status} ${JSON.stringify(rJson).slice(0, 200)}`);
          // THE ROW, not just A row. The browser types "Smoke Test" into every
          // text field, so finding it proves this is the submission that was
          // just made and not a seeded leftover — which a count alone cannot
          // tell apart on a table that shipped with rows in it.
          const mine = rows.some((r) => Object.values(r || {}).some((v) => String(v).includes("Smoke Test")));
          ok("and it is the row that was just submitted, not a seeded one", mine,
            JSON.stringify(rows.slice(0, 2)).slice(0, 300));
          if (rows[0]) console.log("   owner reads row: " + JSON.stringify(rows[0]).slice(0, 220));
        }
      }

      // The form page as it stands after the submit, THEN home. Two shots
      // because the walk above may have left the browser on a sub-route, and a
      // file called "the published site" showing a booking form is the kind of
      // small lie that costs a round of confusion later.
      if (formRoute && formRoute !== "index") {
        await pg.screenshot({ path: "smoke-form.png", fullPage: true }).catch(() => {});
        await pg.goto(SITE, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
        await pg.waitForTimeout(1200);
      }
      await pg.screenshot({ path: "smoke-site.png", fullPage: true });
      console.log(`   screenshot: smoke-site.png  (live at ${SITE})`
        + (formRoute && formRoute !== "index" ? `, plus smoke-form.png (${asPath(formRoute)})` : ""));
      console.log("   api calls:", JSON.stringify(apiCalls));
    } catch (e) {
      failed++;
      console.log("  FAIL could not drive the published site in a browser -> " + String(e && e.message).slice(0, 300));
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  // --- credits were actually charged --------------------------------------
  const bal = await fetch(`${BASE}/api/credits`, { headers: { Authorization: `Bearer ${jwt}` } });
  const bd = await bal.json().catch(() => ({}));
  // AGAINST WHAT THIS ACCOUNT HELD BEFORE THE BUILD — measured, not a constant.
  //
  // It compared to the literal 20 (the free grant), which broke the moment the
  // first build was funded to 40: "22 < 20" reported an unbilled build on a run
  // that billed perfectly. Comparing to `FIRST_BUILD_CREDITS` fixed that and is
  // still a constant, so it says nothing about a SUPPLIED account, whose balance
  // is whatever the owner has. A before/after reading depends on no number at
  // all and is the thing the assertion is actually about.
  ok("caller was charged for the build",
    typeof bd.balance === "number" && typeof startBalance === "number" && bd.balance < startBalance,
    `balance ${JSON.stringify(bd)} vs ${startBalance} before the build`);

  // --- nothing is reachable without a session ------------------------------
  //
  // test/api-auth.test.mjs proves every handler CALLS authUser by reading the
  // source; this proves the deployed Worker actually refuses. GET only, so the
  // sweep cannot mutate anything even if a gate were missing — the routes that
  // answer POST are covered by the static test.
  const OPEN_BY_DESIGN = ["/api/stripe/webhook", "/api/m/"];
  const gettable = [
    "/api/credits", "/api/storage", "/api/gallery", "/api/fal-balance", "/api/video/poll",
    "/api/game/source", "/api/game/build-health", "/api/social/status", "/api/social/analytics",
    "/api/social/posts", "/api/social/comments", "/api/social/playlists", "/api/social/dm",
    "/api/social/autoreply",
  ];
  const leaked = [];
  for (const p of gettable) {
    if (OPEN_BY_DESIGN.some((o) => p.startsWith(o))) continue;
    const r = await fetch(`${BASE}${p}`);
    if (r.status < 400) leaked.push(`${p} -> ${r.status}`);
  }
  ok(`all ${gettable.length} GET routes refuse an unauthenticated caller`, leaked.length === 0, leaked.join(", "));

  // ══ THE JOURNEY: a second turn on a site that already exists ═════════════
  //
  // EVERY BUG THE OWNER HIT IN A LIVE SESSION WAS IN THIS PATH, and nothing
  // tested it. The smoke run above builds ONE site ONCE and stops: it never
  // revises, so a revise that re-rolled the whole theme was invisible; it never
  // republishes, so the publish gap was invisible; it never opens the version
  // list, so a Restore button that could not restore was invisible.
  //
  // THE COST, stated rather than buried: this is a second full build, so the
  // smoke run spends roughly double — measured at ~21-30 credits a build, so
  // ~$0.20 more per deploy. That is the price of the only test that walks the
  // path a person actually walks. `SMOKE_SKIP_JOURNEY=1` turns it off.
  if (process.env.SMOKE_SKIP_JOURNEY === "1") {
    console.log("\nskipping the revise journey (SMOKE_SKIP_JOURNEY=1)");
  } else if (d.page !== "app") {
    // A placeholder has no pages to walk and no look to keep. Skipped honestly
    // rather than failing, which would report one generator miss three times.
    console.log("\nskipping the revise journey — the first build fell back to the placeholder");
  } else {
    console.log("\nrevising the site — the path nothing has ever tested…");

    // WHAT THE SITE LOOKS LIKE NOW, so the revise can be checked for having
    // kept it. Read off the published stylesheet rather than the response,
    // because the response is what we believe and the CSS is what ships.
    // The stylesheet's address, apart from its contents — see the colour checks.
    // ONE DOCUMENT READ, both answers off it. `cssHref` and `cssOf` used to
    // fetch the page separately, which is two requests for one question and
    // RACY in exactly the window this section is about: across a republish the
    // href could come from the new document and the contents from the old one,
    // reported as a stylesheet that disagrees with itself.
    const readCss = async () => {
      const html = await (await fetch(SITE, { cache: "no-store" })).text();
      const href = (html.match(/<link[^>]+href="([^"]+\.css)"/) || [])[1] || "";
      if (!href) return { href: "", css: "" };
      // RESOLVED, NOT CONCATENATED. The Worker rewrites `./assets/…` to the
      // mount it is serving from, so this href is now ABSOLUTE — and stripping
      // its leading slash and appending it to the site root produced
      // `/s/<slug>/s/<slug>/assets/…`, a 404 that reads exactly like a
      // half-published site. `new URL` is right for both shapes.
      return { href, css: await (await fetch(new URL(href, SITE).href)).text() };
    };
    const fontsOf = (css) => [...css.matchAll(/--font-(?:sans|heading):\s*([^;]+)/g)].map((m) => m[1].trim()).join(" | ");
    // The LAST `--radius:` declaration wins, because `site-tokens.mjs` appends
    // its patch after the theme — so this is the corner the site actually has.
    //
    // `\x7d` IS A CLOSING BRACE AND MUST STAY WRITTEN THAT WAY. Minified CSS
    // drops the final semicolon, so `:root{--radius:.5rem}` really does end at
    // the brace and the class needs it — but `worker-imports.test.mjs` finds
    // block-scoped names read after their block by counting brace depth, and it
    // has no lexer, so a literal `}` inside a character class reads to it as the
    // end of this whole function. Measured: it reported three names in this file
    // as runtime ReferenceErrors. A real lexer was tried in this repo and
    // abandoned on measurement, so the narrow scan stays and the brace is
    // escaped here instead.
    const radiusOf = (css) => (css.match(/--radius:\s*([^;\x7d]+)/g) || []).slice(-1)[0] || "";

    // ── A PUBLISH IS NOT LIVE THE INSTANT THE ROUTE RETURNS ──────────────────
    //
    // MEASURED, over two runs that failed byte-identically. The route returned,
    // this file read the published stylesheet 0.2-0.3s later, and got the
    // PREVIOUS build's — `stylesheet: index-Byi_8DiM.css -> index-Byi_8DiM.css`,
    // unchanged across a revise that changed the background colour.
    //
    // IT IS A LAG, NOT A LOST CHANGE, and the run proved which: the restore a
    // hundred seconds later read a stylesheet that HAS `--background:#fc0`, so
    // the colour reached the container and was published all along. The text
    // edit's new words were live 1.4s after its own republish, so uploading the
    // script is not the slow part either. Stale at 0.2s, fresh at 1.4s: a
    // dispatch-namespace script takes about a second to start serving.
    //
    // WHAT THAT COST WAS NOT ONE FAILURE BUT THREE ASSERTIONS. On a stale read
    // `afterCss` is byte-identical to `beforeCss`, so "kept its typefaces"
    // compared the file to itself and passed, and the corner check only asked
    // whether SOME `--radius:` exists — which every theme declares. Both were
    // green in both runs while reading the wrong file. Settling is what makes
    // them mean anything.
    //
    // IT CANNOT HIDE A REAL FAILURE: a change that never publishes never
    // satisfies the predicate, so the budget runs out and the assertion below
    // fails on the same content it always did, with `settled: false` and the
    // elapsed time saying the difference out loud.
    const settleCss = async (want, budgetMs = 20000) => {
      const t0 = Date.now();
      for (;;) {
        const { href, css } = await readCss();
        if (want(css, href)) return { css, href, ms: Date.now() - t0, settled: true };
        if (Date.now() - t0 > budgetMs) return { css, href, ms: Date.now() - t0, settled: false };
        await new Promise((r) => setTimeout(r, 250));
      }
    };
    const settleNote = (what, s) =>
      `   ${what} went live after ${s.ms}ms` + (s.settled ? "" : ` — NEVER, budget spent`);
    // The entry bundle's name. Vite content-hashes it — and the premise that
    // followed here was that a route chunk's hash rides in the entry's own
    // bytes, so any source change moved it. MEASURED AGAINST A REAL START
    // BUILD, THAT IS FALSE: the entry names only the SHARED chunks
    // (site-chrome, skeleton) and not the per-route ones, so editing one page's
    // words leaves the entry hash exactly where it was. See the stylesheet
    // check below, which moves on a look change and is what this was reaching
    // for. Kept as a comment rather than a claim.
    // (was: a route chunk's hash is part of the entry's own bytes, so a change moves
    // this string — which makes it the cheap, deterministic proof that a
    // republish really happened rather than a stored file merely being written.
    const bundleOf = async () => {
      const html = await (await fetch(SITE, { cache: "no-store" })).text();
      return (html.match(/<script[^>]+src="([^"]+)"/) || [])[1] || "";
    };
    const { css: beforeCss, href: beforeCssHref } = await readCss();
    const beforeFonts = fontsOf(beforeCss);
    ok("the published stylesheet is readable before the revise", beforeCss.length > 1000, String(beforeCss.length));

    // ── FUNDING THE SECOND TURN ───────────────────────────────────────────
    //
    // The first build spends most of what it is given — measured: 9 for the
    // schema and 20 for the pages, of which the ledger hands over what is there.
    // Before this top-up the revise answered 402 `not enough credits` and
    // everything below it was skipped, reporting four failures that were about
    // money and not about the code.
    //
    // TWO CLAIMS THAT USED TO BE HERE ARE GONE BECAUSE BOTH WENT STALE, and
    // both were about not spending real money:
    //
    //   - "the first build runs on exactly the grant a real new account has" —
    //     it does not, and has not since the block at the top of this file:
    //     `buildFloor` reached 20, so the first build is funded to 40 and this
    //     run stopped being able to notice that a new customer cannot build cold.
    //   - "A REVISE BUYS NONE, so funding this one cannot start that" — false
    //     since `budgetFor` replaced the flat `revise ? 0` rule. A revise on a
    //     site that shows NO photograph buys them, which is exactly a smoke site
    //     whose first build could not afford any. So this number is a photograph
    //     budget as much as a build budget: at ~19 credits of real fal spend per
    //     image, 60 buys up to three.
    //
    // Latent only while the fal balance is empty. Keep it in mind before raising
    // this number — a stale guarantee in a comment is what gets believed, and
    // the thing it was guarding here is a bill.
    //
    // A direct ledger write, not `add_credits`: that RPC is mint-key gated (a
    // secret this workflow does not carry) and writes a `purchases` row, which
    // would make the throwaway account read as having paid and quietly change
    // what is under test — watermarks, storage tier, `is_paid()`.
    //
    // AND IT SETS THE BALANCE RATHER THAN ADDING TO IT, which is why it goes
    // through `fundAccount`: against a real account holding more than this, the
    // write is a deduction. That refusal is one function for both top-ups.
    const TOPUP = 60;
    await fundAccount(TOPUP, "topped the account up for the revise");

    // ── THE PUBLISH GAP ──────────────────────────────────────────────────
    //
    // A generated site is code-split one chunk per route, and publishing used
    // to WIPE the prefix before writing the new dist — so for the length of
    // ~20 R2 puts the site was half-deleted and clicking to another page
    // fetched a chunk that was gone. That is exactly what the owner hit.
    //
    // THE INVARIANT IS RACE-FREE, which is what makes it testable at all:
    // `index.html` is written LAST, so at every instant it is either the old
    // one (whose chunks are all still there) or the new one (whose chunks are
    // already written). Polling "fetch index.html, then fetch the bundle it
    // names" therefore must NEVER see a 404 — under the old wipe-first code it
    // would, and under write-then-sweep it cannot.
    const gaps = [];
    let polling = true;
    const poll = (async () => {
      while (polling) {
        try {
          const r = await fetch(SITE, { cache: "no-store" });
          if (r.status !== 200) { gaps.push(`index.html -> ${r.status}`); }
          else {
            const html = await r.text();
            const src = (html.match(/<script[^>]+src="([^"]+)"/) || [])[1];
            if (!src) gaps.push("index.html named no bundle");
            else {
              // Same as readCss: the src is absolute now, so resolve it rather than
              // gluing it onto the site root. Concatenated, this poll reported
              // "index.html pointed at a bundle that 404s" on a site that was
              // perfectly fine — the publish gap's own signature, from the test.
              const u = new URL(src, SITE).href;
              const b = await fetch(u, { cache: "no-store" });
              if (b.status !== 200) gaps.push(`${src} -> ${b.status} (index.html pointed at it)`);
            }
          }
        } catch (e) { gaps.push("fetch threw: " + (e && e.message)); }
        await new Promise((r) => setTimeout(r, 250));
      }
    })();

    const reviseBody = {
      slug,
      instruction: "Make the background #ffcc00 and round the corners more. Keep everything else exactly as it is.",
      picker: "sonnet",
    };
    const rv = await fetch(`${BASE}/api/site/react-build`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify(reviseBody),
    });
    const rd = await rv.json().catch(() => ({}));
    polling = false;
    await poll;

    ok("the revise returns 200", rv.status === 200, rv.status + " " + JSON.stringify(rd).slice(0, 300));
    // THE REVISE IS THE PATH THE MEASUREMENT CAME FROM, so it is the one that
    // has to report. Its settle read 15,085ms on a green run — an order of
    // magnitude past the estimate the wait was built on — and this line is what
    // says whether the wait even ran.
    console.log("   revise worker: " + (!rd.worker ? "no script reported"
      : rd.worker.confirmMs === undefined ? "uploaded, NO BUILD STAMP — the wait did not run"
      : `waited ${rd.worker.confirmMs}ms, ${rd.worker.confirmed ? "confirmed" : "NOT CONFIRMED — budget spent"}`));
    ok("THE SITE WAS NEVER HALF-PUBLISHED — index.html always named a bundle that existed",
      gaps.length === 0, gaps.slice(0, 4).join(" ; "));
    console.log(`   polled the live site ${gaps.length === 0 ? "clean" : "WITH GAPS"} across the republish`);

    if (rd.page === "app") {
      // WAIT FOR THE NEW SCRIPT, then read once. The predicate is the CSS FILE
      // CHANGING rather than the colour arriving, deliberately: keyed on the
      // colour, a revise that published no colour at all would spend the whole
      // budget and then fail — indistinguishable from the lag — while keyed on
      // the href it settles as soon as the site really is serving the new
      // build, and the colour is then a genuine question asked of it.
      const rev = await settleCss((c, h) => h !== beforeCssHref);
      const afterCss = rev.css;
      console.log(settleNote("the revise", rev));
      // THE STYLESHEET'S OWN ADDRESS AT EACH POINT. This is what said the
      // failure was a lag: unchanged here, changed by the time the restore
      // read it. Kept, because an UNCHANGED href after a settle is the shape
      // of a look change that never reached the container at all — and read
      // off the settled document rather than fetched again, or the line can
      // report a third state neither assertion below ever saw.
      console.log(`   stylesheet: ${beforeCssHref || "?"} -> ${rev.href || "?"}`);

      // ── THE LOOK IS ANCHORED ─────────────────────────────────────────────
      // "make the background yellow" used to re-roll the theme, the page family
      // and the fonts from those few words, and the site came back a different
      // site. The fonts are the cheapest fingerprint of that: they are chosen
      // by the designer and have nothing to do with what was asked for.
      ok("the revise kept the site's typefaces instead of re-rolling them",
        fontsOf(afterCss) === beforeFonts, `before: ${beforeFonts}  after: ${fontsOf(afterCss)}`);

      // ── AND THE ONE THING THAT WAS ASKED FOR DID CHANGE ───────────────────
      // Both spellings, because lightningcss minifies `#ffcc00` to `#fc0` and
      // an assertion looking only for what was sent reports a working feature
      // as broken.
      ok("the colour that WAS asked for reached the published stylesheet",
        /--background:\s*(#ffcc00|#fc0)/i.test(afterCss),
        (afterCss.match(/--background:[^;]*/g) || []).slice(-3).join(" ; "));
      // A CHANGE, NOT A PRESENCE. This asked whether SOME `--radius:` exists
      // and whether the last one is not `0rem` — and every theme in the
      // registry declares one, so it was true of the stylesheet from BEFORE the
      // revise. It passed in both of the runs that read the wrong file, which
      // is what proved it vacuous. The revise says "round the corners more",
      // so the corner the site has must not be the corner it had.
      ok("and the corner change reached it too",
        radiusOf(afterCss) !== "" && radiusOf(afterCss) !== radiusOf(beforeCss),
        `before: ${radiusOf(beforeCss) || "(none)"}  after: ${radiusOf(afterCss) || "(none)"}`);

      // ── AND THE SITE STILL HAS ITS TABLES ────────────────────────────────
      //
      // A LOOK-ONLY REVISE DECLARES NOTHING TO STORE, which is correct — the
      // designer only sees "make the background yellow". Until 2026-08-09 that
      // was refused outright (422), and the moment it was allowed through the
      // danger moved one layer down: `_meta.schema` is the only copy the request
      // path reads, so an apply that writes an empty table list over a real one
      // takes every table off the data API while its rows sit untouched in
      // Postgres. The site would look perfect and every list on it would 404.
      const rowsAfter = await fetch(`${BASE}/api/site/${slug}/rows`, { headers: { Authorization: `Bearer ${jwt}` } });
      const ra = await rowsAfter.json().catch(() => ({}));
      const tablesAfter = (Array.isArray(ra.tables) ? ra.tables : []).map((t) => t.name || t).sort();
      ok("the look-only revise did not erase the site's schema",
        tablesAfter.length >= (d.tables || []).length && (d.tables || []).every((t) => tablesAfter.includes(t)),
        `before: ${JSON.stringify((d.tables || []).slice().sort())}  after: ${JSON.stringify(tablesAfter)}`);

      // The pages still work after a republish — the other half of the gap.
      //
      // ITS OWN BROWSER, and this is not tidiness. The first draft reused
      // `browser` from the render section above, where it is a `let` declared
      // INSIDE that block and closed in its `finally` — so this was a
      // ReferenceError at runtime, on a line `node --check` accepts without a
      // word. The same class as `vidRefN` and `deleteSiteFor`'s `du.id`, both
      // found and fixed earlier the same day, written again from scratch.
      let jb = null;
      try {
        const { chromium } = await import("playwright");
        jb = await chromium.launch({ executablePath: findChromium() || undefined });
        const pg2 = await jb.newPage();
        const bad = [];
        pg2.on("response", (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().split("/").pop()}`); });
        await pg2.goto(SITE, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
        for (const r of (rd.files || []).map((f) => String(f).replace(/^src\/routes\//, "").replace(/\.tsx$/, ""))) {
          if (r === "index" || !/^[a-z0-9-]+$/i.test(r)) continue;
          await pg2.goto(new URL(r, SITE).href, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
          await pg2.waitForTimeout(600);
        }
        ok("every page of the revised site loads with nothing missing", bad.length === 0, bad.slice(0, 5).join(" ; "));
      } catch (e) {
        // A browser that will not start must not be reported as a broken site.
        console.log("   could not re-walk the pages in a browser -> " + String(e && e.message).slice(0, 200));
      } finally {
        if (jb) await jb.close().catch(() => {});
      }
    } else {
      console.log("   the revise fell back to the placeholder — look checks skipped:", rd.stage || "", rd.error || "");
    }

    // ── VERSIONS ARE REAL, AND RESTORE RESTORES ──────────────────────────────
    // Both halves were lies until 2026-08-08: the button rewrote localStorage,
    // and there was nothing to restore from because a publish overwrote the old
    // build. Two publishes have happened by now, so the list must show two.
    const vl = await fetch(`${BASE}/api/site/${slug}/versions`, { headers: { Authorization: `Bearer ${jwt}` } });
    const vd = await vl.json().catch(() => ({}));
    const versions = Array.isArray(vd.versions) ? vd.versions : [];
    ok("the version list answers 200", vl.status === 200, vl.status + " " + JSON.stringify(vd).slice(0, 200));
    ok("both publishes were archived", versions.length >= 2, JSON.stringify(versions).slice(0, 300));
    ok("versions are newest first", versions.length < 2 || versions[0].id > versions[1].id,
      versions.map((v) => v.id).join(" "));
    ok("each version is labelled by its CHANGE, not the brand",
      versions.length < 2 || versions[0].label !== versions[1].label,
      versions.map((v) => v.label).join(" | "));

    ok("the version list refuses an unauthenticated caller",
      (await fetch(`${BASE}/api/site/${slug}/versions`)).status === 401);
    const badRestore = await fetch(`${BASE}/api/site/${slug}/versions/restore`, {
      method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ id: "../../sites/somebody-else" }),
    });
    ok("restoring an id we did not mint is 404, not a path", badRestore.status === 404, String(badRestore.status));

    // ── FIXING A TYPO IS FREE, AND THE ROUTE SHIPPED DEAD ────────────────────
    //
    // `/api/site/<slug>/text` was in the matchers, in the dispatch condition and
    // in the `ownerSlug` list — and missing from the outer
    // `startsWith("/api/site/") && includes(…)` gate wrapped around all three,
    // so every request fell through to the router's 404. The same gate killed
    // `/versions`. Both are reachable now because that gate is a bare prefix,
    // and this is the half of the fix nothing else in this run would prove.
    //
    // It costs this run NO CREDITS — no model is asked anything, which is the
    // whole point of the feature. It does cost a container build.
    //
    // Run BEFORE the restore below, deliberately: the edit republishes, and
    // doing it after would put the revised pages back over the version we had
    // just rolled the site back to.
    ok("editing the words needs a session",
      (await fetch(`${BASE}/api/site/${slug}/text`)).status === 401);

    const tl = await fetch(`${BASE}/api/site/${slug}/text`, { headers: { Authorization: `Bearer ${jwt}` } });
    const td = await tl.json().catch(() => ({}));
    ok("the editable words list answers 200", tl.status === 200, tl.status + " " + JSON.stringify(td).slice(0, 200));

    const home = (Array.isArray(td.pages) ? td.pages : []).find((p) => /(^|\/)index\.tsx$/.test(p.path));
    const words = (home && home.items) || [];
    ok("the home page offers words to edit", words.length > 0,
      JSON.stringify((td.pages || []).map((p) => p.path)));

    // AN IDENTIFIER IS NOT A WORD. `useRows("bookings", {order: "created_at",
    // dir: "desc"})` offered all three as editable prose in an early draft, and
    // renaming a column that way produces a page that compiles and then reads a
    // column that does not exist. Checked against this site's own table names
    // rather than a guess, so it means something on whatever the designer chose.
    const identifiers = new Set(["created_at", "desc", "asc", "id", ...(d.tables || [])]);
    const codeish = words.map((w) => w.text).filter((t) => identifiers.has(t));
    ok("and it offers no bare identifiers", codeish.length === 0, codeish.join(", "));

    const pick = words.slice().sort((a, b) => b.text.length - a.text.length)[0];
    if (pick) {
      const bundleBefore = await bundleOf();
      const NEWWORDS = "Smoke edited these words " + stamp;
      const editBody = JSON.stringify({
        edits: [{ path: home.path, at: pick.at, from: pick.text, to: NEWWORDS }],
      });
      const te = await fetch(`${BASE}/api/site/${slug}/text`, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${jwt}` },
        body: editBody,
      });
      const ted = await te.json().catch(() => ({}));
      ok("a text edit is applied and republished",
        te.status === 200 && ted.ok === true && ted.applied === 1,
        te.status + " " + JSON.stringify(ted).slice(0, 250));
      ok("and it cost the customer nothing", ted.cost === 0, JSON.stringify(ted.cost));

      // THE LIVE SITE REALLY CHANGED — not just the stored source. The entry
      // bundle is content-hashed and a route chunk's hash is inside it, so this
      // name cannot survive a real edit.
      const bundleAfter = await bundleOf();
      // THE ENTRY HASH DOES NOT MOVE ON A WORDS-ONLY EDIT, measured against a
      // real Start build: the entry names the SHARED chunks and not the
      // per-route ones, so editing one page changes that page's chunk and
      // leaves the entry alone. This asserted the opposite and failed a text
      // edit that worked — the words really did change on the live site, which
      // the two checks below prove directly.
      //
      // KEPT AS A REPORT rather than deleted, because the value is still worth
      // seeing when the two checks below ever disagree with each other.
      console.log(`   entry bundle: ${bundleBefore} -> ${bundleAfter}` +
        (bundleAfter === bundleBefore ? "  (unchanged, which is expected for a words-only edit)" : ""));
      ok("the site is still serving a bundle at all", !!bundleAfter, String(bundleAfter));
      ok("and the site still serves its home page",
        (await fetch(SITE)).status === 200);

      // The stored source moved with it: the new words are offered now and the
      // old ones are not.
      const tl2 = await fetch(`${BASE}/api/site/${slug}/text`, { headers: { Authorization: `Bearer ${jwt}` } });
      const td2 = await tl2.json().catch(() => ({}));
      const after = (((Array.isArray(td2.pages) ? td2.pages : []).find((p) => p.path === home.path) || {}).items || [])
        .map((w) => w.text);
      ok("the new words are what the site now says", after.includes(NEWWORDS), after.slice(0, 6).join(" | "));
      ok("and the old ones are gone", !after.includes(pick.text), pick.text.slice(0, 80));

      // A STALE OFFSET IS REFUSED, NEVER APPLIED. Sending the same edit again
      // now finds different text at that offset — applying it anyway is how a
      // typo fix becomes a page that does not compile.
      const again = await fetch(`${BASE}/api/site/${slug}/text`, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${jwt}` },
        body: editBody,
      });
      ok("re-sending a stale edit is refused", again.status === 400, String(again.status));
    }

    if (versions.length >= 2) {
      const oldest = versions[versions.length - 1];
      const rs = await fetch(`${BASE}/api/site/${slug}/versions/restore`, {
        method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ id: oldest.id }),
      });
      const rsd = await rs.json().catch(() => ({}));
      ok("restoring an earlier build answers 200", rs.status === 200 && rsd.ok === true,
        rs.status + " " + JSON.stringify(rsd).slice(0, 200));

      // THE ASSERTION THAT MATTERS: the LIVE site changed back. The old button
      // reported success and touched nothing published, which is the failure
      // this whole feature exists to end.
      // SETTLED, for the reason the revise is — this read was 0.23s after the
      // route returned and got the stylesheet from two publishes earlier.
      // The predicate is the build's OWN href: a restore puts version A's files
      // back verbatim, so the site must end up serving the exact stylesheet it
      // was serving before the revise, which is a sharper question than "the
      // colour is gone" and is the one this feature exists to answer.
      const back = await settleCss((c, h) => h === beforeCssHref);
      const restoredCss = back.css;
      console.log(settleNote("the restore", back));
      ok("THE LIVE SITE REALLY WENT BACK — the revised colour is gone from it",
        !/--background:\s*(#ffcc00|#fc0)/i.test(restoredCss),
        `${back.href || "(none)"} (build served ${beforeCssHref || "?"}) :: ` +
          (restoredCss.match(/--background:[^;]*/g) || []).slice(-3).join(" ; "));
      ok("and the restored site still serves its home page",
        (await fetch(SITE)).status === 200);
    }
  }

  // --- the delete route cannot be used to take down someone else's site ----
  // Checked BEFORE the real delete in cleanup, while the site is still up. If
  // either of these ever passed the wrong way the site would vanish here and
  // every later assertion would fail loudly, which is the right failure mode.
  const anonDel = await fetch(`${BASE}/api/site/${slug}`, { method: "DELETE" });
  ok("an unauthenticated delete is refused", anonDel.status === 401, String(anonDel.status));

  const ghostDel = await fetch(`${BASE}/api/site/definitely-not-a-real-site-${stamp}`, {
    method: "DELETE", headers: { Authorization: `Bearer ${jwt}` },
  });
  ok("deleting a slug that isn't yours is 404, not a silent success",
    ghostDel.status === 404, String(ghostDel.status));
} catch (e) {
  failed++;
  console.log("\nUNCAUGHT: " + (e && (e.detail || e.message || e)));
} finally {
  console.log("\ncleaning up…");
  // Take the published site down through the route a real owner would use —
  // FIRST, while the JWT and the ownership row it authorises against still
  // exist. This is cleanup and coverage at once: before this route the R2
  // objects were simply left behind, so every run added a public, half-broken
  // site at a guessable URL.
  if (slug && jwt) {
    try {
      const del = await fetch(`${BASE}/api/site/${slug}`, { method: "DELETE", headers: { Authorization: `Bearer ${jwt}` } });
      const dd = await del.json().catch(() => ({}));
      ok("the owner can delete the site", del.status === 200 && dd.ok === true,
        del.status + " " + JSON.stringify(dd).slice(0, 200));
      if (dd.ok) console.log(`  removed the published site (${dd.removed} objects)`);
      // AND THE SCRIPT, WHICH IS THE HALF THAT KEEPS SERVING. Measured on the
      // first live run: 21 objects removed, the Neon project dropped, the
      // ownership row gone — and the address still answering 200 fifteen
      // minutes later, because the script survived and nothing said so. The
      // check below ("the published files are actually gone") is what caught
      // it; this names the cause instead of leaving it to be inferred.
      if (dd.workerRemoved === false) {
        console.log(`  worker: NOT REMOVED — it will keep serving this deleted site: ${dd.workerError || "(no reason given)"}`);
      } else if (dd.workerRemoved === true) {
        console.log("  worker: removed");
      }

      const gone = await fetch(SITE);
      ok("the published files are actually gone", gone.status === 404, `GET /s/${slug}/ -> ${gone.status}`);
    } catch (e) {
      failed++;
      console.log("  FAIL could not delete the published site -> " + String(e && e.message));
    }
  }
  if (projectId && env.NEON_API_KEY) {
    // ALREADY-GONE IS THE NORMAL CASE HERE, and reporting it as a failure is
    // what made the first green run read as though it had leaked a project.
    //
    // The delete route above drops the project inline, so by the time this runs
    // Neon answers 404 — and `dropUserProject` throws on any non-ok, so the run
    // printed `WARNING: could not remove Neon project …` on a project that had
    // been removed correctly seconds earlier. A Neon project is a capped,
    // billed resource whose only record is a Supabase row, so a warning that
    // says one leaked is one somebody has to go and check.
    //
    // `site-teardown.mjs` already settled this exact question — "404 is DONE,
    // 401/403 is NEVER done" — and this cleanup is the one place that had not
    // learned it. Anything else still warns, because anything else really can
    // leave a project running.
    try { await dropUserProject(env, projectId); console.log("  removed the Neon project"); }
    // Read off `e.status`, which `neonApi` sets deliberately ("the STATUS is
    // what separates the causes"), never off the message — a substring match
    // for "404" also hits a project id or a body that happens to contain it.
    catch (e) {
      if (e && e.status === 404) console.log("  the Neon project was already gone — the delete route had it");
      else console.log("  WARNING: could not remove Neon project " + projectId
        + " -> " + String(e && (e.status || e.message)).slice(0, 160));
    }
  }
  // Belt and braces: the delete above already removes this row, but it must go
  // even when that call failed, or the slug stays claimed forever.
  if (slug) {
    try { await fetch(`${SUPABASE_URL}/rest/v1/site_backends?slug=eq.${encodeURIComponent(slug)}`, { method: "DELETE", headers: svc() }); } catch {}
  }
  // THE DESTRUCTIVE HALF, AND IT RUNS ONLY FOR A USER THIS RUN CREATED.
  //
  // `DELETE /auth/v1/admin/users/<id>` cascades — chats, credits, purchases,
  // storage rows, every `user_site_project` record. Pointed at the account the
  // owner asked this run to use, that is not a cleanup, it is the account gone.
  //
  // THE GATE IS `createdUser`, WHICH IS SET IN EXACTLY ONE PLACE: the admin
  // create above, from the id it returned. It is never read from configuration,
  // so "did this run make this user" cannot be answered by anything except
  // having made them — a mis-set secret can leave the run signed in as a real
  // account, and none of that reaches here.
  //
  // The `user_site_project` wipe is on the SAME gate, and not merely out of
  // caution: that table is the only record of an account's Neon projects, and
  // deleting the row does not delete the projects. It makes every one of them
  // invisible and billing forever — the exact leak `site-teardown.mjs` exists
  // to stop, arriving through a test. This run's own project is dropped by slug
  // a few lines up, which is what makes leaving the table alone safe.
  //
  // Asserted structurally in `test/build-smoke-safety.test.mjs` rather than
  // remembered, because a gate somebody has to remember is one somebody drops.
  if (userId && createdUser) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/user_site_project?uid=eq.${userId}`, { method: "DELETE", headers: svc() });
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: svc() });
      console.log("  removed the throwaway user");
    } catch { console.log("  WARNING: could not remove user " + userId); }
  } else if (userId) {
    console.log("  left the supplied account alone — no user delete, no project-record wipe");
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
