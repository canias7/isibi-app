// DELETING A SITE NAMES WHAT IS LOST, AND ASKS FOR THE NAME (2026-10-26, owner):
// "This deletes Saltmarsh, its database with 42 orders, and 3 pages. Type the
// site name to confirm." The counts come from an owner-checked, read-only
// `GET /api/site/<slug>/delete-preview`; a count that could not be read is said
// so, never 0. `DELETE /api/site/<slug>` refuses (400) without a `confirm` equal
// to the slug or the site's name; the account-deletion sweep calls
// `deleteSiteFor` directly and is not asked for one.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { loadWorkerModule, makeCtx } from "./fixtures/worker-harness.mjs";

const DC = createRequire(import.meta.url)("../public/delete-confirm.js");
const ME = "u-owner-1", OTHER = "u-other-2";
const SLUG = "saltmarsh-1";

/** Supabase as these routes see it: the signed-in user and the site's row. */
function wire({ row = { uid: ME, display_name: "Saltmarsh" }, delRow = undefined, failRow = false, list = [SLUG] } = {}) {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (u, init = {}) => {
    const url = String(u && u.url || u);
    calls.push({ url, method: (init && init.method) || "GET" });
    const j = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
    if (url.includes("/auth/v1/user")) return j({ id: ME, email: "o@example.com" });
    if (url.includes("/rest/v1/site_backends?uid=eq.")) return j(list.map((slug) => ({ slug })));
    if (url.includes("/rest/v1/site_backends?slug=eq.")) {
      if (failRow) return j({ message: "down" }, 500);
      // deleteSiteFor's own lookup (`select=uid,<chat column>`) can be answered apart.
      if (delRow !== undefined && /select=uid,(?!display_name)/.test(url)) return j(delRow ? [delRow] : []);
      return j(row ? [row] : []);
    }
    return j([], 200);
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}
const ENV = { SUPABASE_SERVICE_KEY: "svc-test" };
async function hit(wk, method, path, body, { auth = true } = {}) {
  const headers = auth ? { Authorization: "Bearer t" } : {};
  const init = { method, headers };
  if (body !== undefined) { init.body = typeof body === "string" ? body : JSON.stringify(body); headers["content-type"] = "application/json"; }
  const r = await wk.default.fetch(new Request("https://gofarther.dev" + path, init), ENV, makeCtx());
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch { json = null; }
  return { status: r.status, json, text };
}

// ── the preview route ─────────────────────────────────────────────────────
test("PREVIEW IS OWNER-CHECKED — signed out 401, another account's site 403, no row 404, a failed lookup 503 (never 'no such site')", async () => {
  const wk = await loadWorkerModule();
  const path = "/api/site/" + SLUG + "/delete-preview";
  let w = wire();
  try { assert.equal((await hit(wk, "GET", path, undefined, { auth: false })).status, 401); } finally { w.restore(); }
  w = wire({ row: { uid: OTHER, display_name: "Theirs" } });
  try { const r = await hit(wk, "GET", path); assert.equal(r.status, 403, r.text); assert.equal(r.json.name, undefined, "a refusal leaks nothing of the site"); } finally { w.restore(); }
  w = wire({ row: null });
  try { assert.equal((await hit(wk, "GET", path)).status, 404); } finally { w.restore(); }
  w = wire({ failRow: true });
  try { assert.equal((await hit(wk, "GET", path)).status, 503); } finally { w.restore(); }
});

test("PREVIEW READS ONLY — the owner's answer through the real route names the site; no write is sent", async () => {
  const wk = await loadWorkerModule();
  const w = wire();
  try {
    const r = await hit(wk, "GET", "/api/site/" + SLUG + "/delete-preview");
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.name, "Saltmarsh");
    assert.equal(r.json.slug, SLUG);
    assert.ok(w.calls.length > 0, "observer: calls were seen");
    assert.deepEqual(w.calls.filter((c) => c.method !== "GET"), [], "the preview wrote something");
  } finally { w.restore(); }
});

test("PREVIEW COUNTS — pages, the database and each table's rows, as read", async () => {
  const { deletePreviewApi } = await loadWorkerModule();
  const w = wire();
  try {
    const r = await deletePreviewApi.deletePreviewFor(ENV, ME, SLUG, { pages: async () => 3, conn: async () => "postgres://x", count: async () => ({ orders: 42, lessons: 5 }) });
    const j = await r.json();
    assert.deepEqual(j, { ok: true, slug: SLUG, name: "Saltmarsh", pages: 3, database: true, tables: { orders: 42, lessons: 5 } });
    assert.equal(DC.sentence(j), "This deletes Saltmarsh, its database with 42 orders and 5 lessons, and 3 pages. Type the site name to confirm.");
  } finally { w.restore(); }
});

test("PREVIEW UNREADABLE — counts that cannot be read are null, never 0; a connection that cannot be told is database null; no database is false", async () => {
  const { deletePreviewApi } = await loadWorkerModule();
  const w = wire();
  try {
    const run = async (deps) => (await deletePreviewApi.deletePreviewFor(ENV, ME, SLUG, deps)).json();
    const a = await run({ pages: async () => 3, conn: async () => "c", count: async () => { throw new Error("neon down"); } });
    assert.equal(a.database, true); assert.equal(a.tables, null);
    const a2 = await run({ pages: async () => 3, conn: async () => "c", count: async () => null });
    assert.equal(a2.tables, null);
    const b = await run({ pages: async () => { throw new Error("r2"); }, conn: async () => { throw new Error("unreadable"); } });
    assert.equal(b.database, null); assert.equal(b.pages, null);
    const c = await run({ pages: async () => 2, conn: async () => null });
    assert.equal(c.database, false); assert.equal(c.tables, null);
    assert.ok(!JSON.stringify([a, a2, b]).includes(":0"), "an unread count became 0");
  } finally { w.restore(); }
});

// ── the DELETE's confirmation ─────────────────────────────────────────────
test("DELETE REFUSES WITHOUT CONFIRM — no body, an empty or non-string confirm, or a wrong name: 400, and nothing is looked up or torn down", async () => {
  const wk = await loadWorkerModule();
  for (const body of [undefined, "", "not json", {}, { confirm: "" }, { confirm: "   " }, { confirm: ["saltmarsh-1"] }, { confirm: 1 }]) {
    const w = wire();
    try {
      const r = await hit(wk, "DELETE", "/api/site/" + SLUG, body);
      assert.equal(r.status, 400, JSON.stringify(body) + " " + r.text);
      assert.deepEqual(w.calls.filter((c) => c.url.includes("/rest/v1/")), [], "a refused delete read the store");
    } finally { w.restore(); }
  }
  const w = wire();
  try {
    const r = await hit(wk, "DELETE", "/api/site/" + SLUG, { confirm: "Saltmarsh Bakery" });
    assert.equal(r.status, 400, r.text);
    assert.deepEqual(w.calls.filter((c) => c.method === "DELETE"), [], "a wrong name tore something down");
  } finally { w.restore(); }
});

test("DELETE WITH CONFIRM REACHES THE DELETE — the slug or the site's name (any case, trimmed) passes the check to deleteSiteFor's own owner check", async () => {
  const wk = await loadWorkerModule();
  for (const confirm of [SLUG, " SALTMARSH-1 ", "saltmarsh", "  Saltmarsh "]) {
    // The name check reads the caller's own row; deleteSiteFor's own lookup is
    // answered as another account's, so it stops at its 403 and nothing is torn down.
    const w = wire({ row: { uid: ME, display_name: "Saltmarsh" }, delRow: { uid: OTHER } });
    try {
      const r = await hit(wk, "DELETE", "/api/site/" + SLUG, { confirm });
      assert.equal(r.status, 403, confirm + " " + r.text);
      assert.equal(r.json.error, "not your site");
      // deleteSiteFor's own lookup (`select=uid,<chat column>`), not only the name check's.
      assert.ok(w.calls.some((c) => /select=uid,(?!display_name)/.test(c.url)), confirm + ": deleteSiteFor was not reached " + JSON.stringify(w.calls.map((c) => c.url)));
    } finally { w.restore(); }
  }
});

test("THE ACCOUNT SWEEP STILL DELETES WITHOUT A CONFIRM — POST /api/site/delete-all reaches deleteSiteFor for each listed site", async () => {
  const wk = await loadWorkerModule();
  const w = wire({ row: { uid: OTHER } });
  try {
    const r = await hit(wk, "POST", "/api/site/delete-all", {});
    assert.equal(r.status, 207, r.text);
    assert.deepEqual(r.json.failed, [SLUG], "deleteSiteFor's own 403 was reached");
    assert.ok(w.calls.some((c) => c.url.includes("site_backends?slug=eq." + SLUG)), "observer: the slug was looked up by deleteSiteFor");
  } finally { w.restore(); }
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const a = src.indexOf('url.pathname === "/api/site/delete-all"');
  assert.ok(a > 0, "delete-all moved");
  assert.ok(src.slice(a, a + 3000).includes("await deleteSiteFor(env, au.id, slug)"), "the sweep no longer calls deleteSiteFor directly");
});

test("THE CLIENT SENDS THE CONFIRMATION, AND THE ORPHAN SWEEP SCRIPT TOO", () => {
  const chat = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(chat, /apiFetch\('\/api\/site\/' \+ encodeURIComponent\(s\.slug\), \{ method: 'DELETE', headers: \{ 'content-type': 'application\/json' \}, body: JSON\.stringify\(\{ confirm: s\.slug \}\) \}\)/);
  assert.match(chat, /'\/delete-preview'/);
  assert.match(chat, /DeleteConfirm\.ask\(document, pv\)/);
  const sweep = readFileSync(new URL("../.github/scripts/sweep-orphan-site.mjs", import.meta.url), "utf8");
  assert.ok(sweep.includes('"content-type": "application/json" }, body: JSON.stringify({ confirm: slug }) });'), "the orphan sweep sends no confirm");
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  assert.ok(html.indexOf('src="/delete-confirm.js"') > 0 && html.indexOf('src="/delete-confirm.js"') < html.indexOf('src="/chat.js"'), "delete-confirm.js loads before chat.js");
});

// ── the sentence ──────────────────────────────────────────────────────────
test("THE SENTENCE — tables in plain English, no database, unreadable counts said in words, never 0", () => {
  assert.equal(DC.sentence({ name: "Saltmarsh", pages: 3, database: true, tables: { orders: 42 } }),
    "This deletes Saltmarsh, its database with 42 orders, and 3 pages. Type the site name to confirm.");
  assert.equal(DC.sentence({ name: "Fretwork", pages: 1, database: true, tables: { order_items: 1, lessons: 5, guestBook: 2 } }),
    "This deletes Fretwork, its database with 1 order item, 5 lessons and 2 guest book, and 1 page. Type the site name to confirm.");
  assert.equal(DC.sentence({ name: "Ashgrove", pages: 4, database: false, tables: null }),
    "This deletes Ashgrove and its 4 pages. Type the site name to confirm.");
  assert.equal(DC.sentence({ name: "Ashgrove", pages: null, database: false }),
    "This deletes Ashgrove and its pages. Type the site name to confirm.");
  assert.equal(DC.sentence({ name: "Saltmarsh", pages: 3, database: true, tables: null }),
    "This deletes Saltmarsh, its database (couldn't count its entries), and 3 pages. Type the site name to confirm.");
  assert.equal(DC.sentence({ name: "Saltmarsh", pages: 3, database: true, tables: { orders: null } }),
    "This deletes Saltmarsh, its database (couldn't count its entries), and 3 pages. Type the site name to confirm.");
  assert.equal(DC.sentence({ name: "Saltmarsh", pages: 3, database: true, tables: { orders: 42, lessons: null } }),
    "This deletes Saltmarsh, its database with 42 orders (couldn't count the rest), and 3 pages. Type the site name to confirm.");
  assert.equal(DC.sentence({ name: "Saltmarsh", pages: 3, database: true, tables: { orders: 0 } }),
    "This deletes Saltmarsh, its database (no entries yet), and 3 pages. Type the site name to confirm.");
  assert.equal(DC.sentence({ name: "Saltmarsh", pages: 3, database: null, tables: null }),
    "This deletes Saltmarsh, its database, if it has one (couldn't check), and 3 pages. Type the site name to confirm.");
  for (const t of [null, { orders: null }, { a: null, b: null }]) {
    assert.doesNotMatch(DC.sentence({ name: "S", pages: 2, database: true, tables: t }), /\b0\b/, "an unread count shown as 0");
  }
});

test("THE NAME CHECK — case-insensitive and trimmed; empty never matches", () => {
  assert.equal(DC.matches("saltmarsh", "Saltmarsh"), true);
  assert.equal(DC.matches("  SALTMARSH ", "Saltmarsh"), true);
  assert.equal(DC.matches("Saltmars", "Saltmarsh"), false);
  assert.equal(DC.matches("", ""), false);
  assert.equal(DC.matches("   ", "  "), false);
  assert.equal(DC.matches(null, "Saltmarsh"), false);
});

// ── the dialog, in a real browser ─────────────────────────────────────────
const EXE = "/opt/pw-browsers/chromium";
let chromium = null;
try { ({ chromium } = await import("playwright-core")); } catch { chromium = null; }
const SKIP = !chromium || !existsSync(EXE) ? "no Chromium here" : false;
const SHOTS = process.env.DELETE_CONFIRM_SHOTS || "";

test("THE DIALOG — Delete stays disabled until the typed text is the site's name; Cancel and Escape close it false; Delete answers true", { skip: SKIP, timeout: 60000 }, async () => {
  const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
  const js = readFileSync(new URL("../public/delete-confirm.js", import.meta.url), "utf8");
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    const page = await browser.newPage({ viewport: { width: 720, height: 520 }, deviceScaleFactor: 2 });
    await page.setContent("<!doctype html><html><head><style>" + css + "</style></head><body><script>" + js + "</script></body></html>");
    const open = (p) => page.evaluate((pv) => { window.__ans = undefined; DeleteConfirm.ask(document, pv).then((v) => { window.__ans = v; }); }, p);
    const answer = () => page.waitForFunction(() => window.__ans !== undefined).then(() => page.evaluate(() => window.__ans));
    const disabled = () => page.$eval(".go-confirm-yes", (b) => b.disabled);
    const cases = [
      ["with-db", { slug: "saltmarsh-1", name: "Saltmarsh", pages: 3, database: true, tables: { orders: 42, lessons: 5 } }],
      ["no-db", { slug: "ashgrove-1", name: "Ashgrove", pages: 4, database: false, tables: null }],
      ["unreadable", { slug: "fretwork-1", name: "Fretwork", pages: 3, database: true, tables: null }],
    ];
    for (const [tag, pv] of cases) {
      await open(pv);
      await page.waitForSelector(".go-confirm-input");
      assert.equal(await page.$eval(".go-confirm-text", (e) => e.textContent), DC.sentence(pv));
      assert.equal(await disabled(), true, "Delete lit before anything was typed");
      await page.fill(".go-confirm-input", pv.name.slice(0, -1));
      assert.equal(await disabled(), true, "Delete lit on a partial name");
      await page.click(".go-confirm-yes", { force: true });
      assert.ok(await page.$(".go-confirm"), "a disabled Delete closed the dialog");
      await page.fill(".go-confirm-input", "  " + pv.name.toUpperCase() + " ");
      assert.equal(await disabled(), false, "Delete stayed dark on the name");
      if (SHOTS) await page.screenshot({ path: SHOTS + "/delete-confirm-" + tag + ".png" });
      if (tag === "with-db") { await page.click(".go-confirm-yes"); assert.equal(await answer(), true); }
      else if (tag === "no-db") { await page.keyboard.press("Escape"); assert.equal(await answer(), false); }
      else { await page.click(".go-confirm-no"); assert.equal(await answer(), false); }
      assert.equal(await page.$(".go-confirm"), null, "the dialog stayed open");
    }
  } finally { await browser.close(); }
});
