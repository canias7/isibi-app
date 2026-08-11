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
  else { failed++; console.log(`  FAIL ${name}${extra ? "  -> " + String(extra).slice(0, 300) : ""}`); }
};
const svc = (extra) => ({ apikey: SVC, Authorization: `Bearer ${SVC}`, "content-type": "application/json", ...(extra || {}) });

const stamp = Date.now().toString(36);
const email = `edit-smoke-${stamp}@gofarther.dev`;
const password = `Es-${stamp}-${Math.random().toString(36).slice(2, 10)}`;
// A SLUG WE CHOOSE, for the reason `build smoke` already records: a slug is
// claimed by whoever built it first across every account, so letting the
// designer name the site from a fixed brief means it proposes the same good name
// every run and the second run 409s on something that is not a bug.
const slug = `esmoke-${stamp}-${Math.random().toString(36).slice(2, 6)}`;
let userId = null, jwt = null;

const api = (path, init) => fetch(`${BASE}${path}`, {
  ...(init || {}),
  headers: { "content-type": "application/json", Authorization: `Bearer ${jwt}`, ...((init || {}).headers || {}) },
});
const post = (path, body) => api(path, { method: "POST", body: JSON.stringify(body) });
const jsonOf = async (r) => { try { return await r.json(); } catch { return null; } };

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
  const made = await jsonOf(mk);
  userId = made && made.id;
  ok("created a throwaway user", !!userId, JSON.stringify(made));
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
  console.log(`\nbuilding a real site… ${slug}`);
  const t0 = Date.now();
  const br = await post("/api/site/react-build", {
    slug,
    brief: "A barber shop in Sheffield called Ridge & Bone. A price list of services, and a page where people can book a chair.",
    picker: "sonnet",
  });
  const b = (await jsonOf(br)) || {};
  ok("the build returns 200", br.status === 200, `${br.status} ${JSON.stringify(b).slice(0, 200)}`);
  ok("a real app was published, not the placeholder", b.page === "app",
    `page=${b.page} stage=${b.stage} error=${String(b.error || "").slice(0, 160)}`);
  console.log(`   ${Math.round((Date.now() - t0) / 1000)}s, ${b.cost} credits, pages: ${(b.files || []).length}`);
  // EVERYTHING BELOW NEEDS A REAL APP. On the placeholder there is no page source
  // to edit and no nav to add to, so the lanes would correctly refuse and the run
  // would report a pile of failures about a build that never happened.
  if (b.page !== "app") { console.log("\nskipping the lanes — the build fell back to the placeholder"); return; }

  const digest = { name: b.brand || "", url: b.url || "", pages: (b.files || []).slice(0, 24), tables: b.tables || [] };

  // --- what the site stores, so the instructions can name something real ----
  const tr = await api(`/api/site/${slug}/rows`);
  const tabs = ((await jsonOf(tr)) || {}).tables || [];
  const display = tabs.find((t) => t.access === "display" && (t.count || 0) > 0) || tabs[0];
  ok("the site stores something we can edit", !!display, JSON.stringify(tabs).slice(0, 200));
  if (!display) return;
  const rowsOf = async () => (((await jsonOf(await api(`/api/site/${slug}/rows/${display.name}`))) || {}).rows) || [];
  let rows = await rowsOf();
  ok(`"${display.name}" came back seeded`, rows.length > 0, `${rows.length} rows`);
  if (!rows.length) return;
  // The first column that carries words — what a person would name in a sentence.
  const col = (display.columns || []).find((c) => typeof rows[0][c] === "string" && rows[0][c].trim());
  const first = col ? String(rows[0][col]) : "";
  ok("…and a row we can name in an instruction", !!first, JSON.stringify(rows[0]).slice(0, 160));
  if (!first) return;

  // ── THE ROUTER ────────────────────────────────────────────────────────────
  //
  // Never driven live before. Every claim about which lane a sentence lands in
  // came from unit tests against fake model replies.
  console.log("\nthe router picks a lane…");
  const rData = await route(`Change the price of the ${first} to £26`, digest);
  ok("a price change routes to the DATA layer", rData.intent === "edit" && rData.layer === "data",
    `intent=${rData.intent} layer=${rData.layer}`);
  const rLook = await route("Make the background a warm cream", digest);
  ok("a colour change routes to the LOOK layer", rLook.intent === "edit" && rLook.layer === "look",
    `intent=${rLook.intent} layer=${rLook.layer}`);
  const rAdd = await route("Add a gallery page showing our work", digest);
  ok("a new page routes to the ADDON lane", rAdd.intent === "addon", `intent=${rAdd.intent}`);
  // The cheapest interaction there is must not build anything.
  const rAsk = await route("Can you read a link if I paste one?", digest);
  ok("a question is answered, not built", rAsk.intent === "ask" && !!rAsk.answer,
    `intent=${rAsk.intent} answer=${String(rAsk.answer || "").slice(0, 80)}`);

  // ── THE DATA LAYER: a row changes, and NOTHING is recompiled ──────────────
  console.log("\nchanging a row…");
  const ed = await post(`/api/site/${slug}/edit`, {
    layer: "data", instruction: `Change the price of the ${first} to £26`, picker: "sonnet",
  });
  const e = (await jsonOf(ed)) || {};
  ok("the data edit succeeds", ed.status === 200 && e.ok === true, `${ed.status} ${JSON.stringify(e).slice(0, 200)}`);
  ok("…and it says which rows moved", Array.isArray(e.applied) && e.applied.length > 0, JSON.stringify(e.applied));
  // THE POINT OF THIS LANE: rows are read at runtime, so nothing is rebuilt and
  // nothing is republished. A recompile here would mean the cheapest change on
  // the platform is quietly paying for the most expensive step.
  ok("…and no files were republished", !e.files || !e.files.length, JSON.stringify(e.files || []).slice(0, 120));
  rows = await rowsOf();
  ok("the change really is in the database", JSON.stringify(rows).includes("26"), JSON.stringify(rows).slice(0, 200));

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
  ok("the look edit succeeds", lk.status === 200 && l.ok === true, `${lk.status} ${JSON.stringify(l).slice(0, 200)}`);
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
    ok("…and the PUBLISHED page says the new name", html.includes(newName),
      `${live.status}, ${html.length} bytes`);
  }

  // ── THE ADDON LANE ────────────────────────────────────────────────────────
  console.log("\nadding a page, then taking it away…");
  const ad = await post(`/api/site/${slug}/addon`, {
    instruction: "Add a gallery page showing photographs of our work, and link to it from the header",
    picker: "sonnet",
  });
  const a = (await jsonOf(ad)) || {};
  ok("the addon succeeds", ad.status === 200 && a.ok === true, `${ad.status} ${JSON.stringify(a).slice(0, 240)}`);
  const added = (a.added || [])[0];
  ok("…and a page was added", !!added, JSON.stringify(a.added));
  // THE WHOLE POINT OF THE LANE: it adds without rewriting. A returned set the
  // size of the site is a revise wearing an addon's clothes.
  ok("…and it did not rewrite the whole site", (a.changed || []).length <= 2, JSON.stringify(a.changed));

  if (added) {
    const rmp = await post(`/api/site/${slug}/addon`, {
      instruction: "Actually remove the gallery page again, and take the link out of the header",
      picker: "sonnet",
    });
    const p = (await jsonOf(rmp)) || {};
    // A REFUSAL IS A RESULT TOO. If it declined because something still links to
    // the page, that is the guard working — but it must SAY so rather than
    // reporting success, which is what the `kept` field is for.
    const removed = (p.removed || []).length > 0;
    const kept = (p.kept || []).length > 0;
    ok("a page can be removed, or the refusal explains itself", removed || kept || !!p.msg,
      `${rmp.status} ${JSON.stringify(p).slice(0, 240)}`);
    if (removed) ok("…and the page really went", (p.removed || []).includes(added), JSON.stringify(p.removed));
  }

  // --- and the owner can take it all down ----------------------------------
  console.log("\ncleaning up…");
  const del = await api(`/api/site/${slug}`, { method: "DELETE" });
  ok("the owner can delete the site", del.status === 200, String(del.status));
}

main()
  .catch((e) => { failed++; console.log("  FAIL the run threw  -> " + String((e && e.message) || e).slice(0, 300)); })
  .finally(async () => {
    // The Neon project first — it is a capped, billed resource whose only record
    // is a Supabase row, and deleting the user cascades that row away.
    try { if (userId && env.NEON_API_KEY) await dropUserProject(env, userId).catch(() => {}); } catch { /* best effort */ }
    if (userId) {
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: svc() }).catch(() => {});
      console.log("  removed the throwaway user");
    }
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  });
