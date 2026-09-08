// THE SITE BELONGS TO THE CHAT THAT BUILT IT.
//
// Owner, 2026-09-08: "the problem is that is the build gotta stay in that chat,
// not make a new one" -> "yeah it should per project type thing right?" -> and,
// on the sites already loose, "idc abut past stuff, but lets fix anything fro
// future stuff".
//
// THE ID EXISTED AND WAS NEVER SENT. `siteCreate` in `public/chat.js` mints one
// per workspace and threads it through every call as `origin`; the server had
// never seen it. So a build whose answer got lost -- which, before the fix one
// commit back, was EVERY long build -- left the workspace empty and the finished
// site standing alone on the start screen as a card of its own.
//
// WHAT THESE ASSERT, and why each is driven rather than read. The chain is
// browser -> wire -> route -> Postgres -> list -> browser, and this repository
// has shipped twelve-plus features dead with every module correct and one hop
// cut. Two of the hops here are the exact shape of that trap: the send (a field
// that exists in the file and is never put on the body) and the short-circuit (a
// lookup whose answer nobody acts on). Both are DRIVEN.
//
// The one thing no test here can prove is the uniqueness constraint: a partial
// index only differs from no index under a second writer. That is
// `scripts/chat-index-check.sql`, run against the live database and rolled back
// -- ALL 7 CHECKS PASSED, 2026-09-08. These guards hold the code to the same
// spelling that script proves.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { cleanChatId, CHAT_COLUMN, CHAT_ID_RE } from "../builder/site-chat.mjs";
// A UMD file: `default` under Node, the namespace otherwise. Read the way
// `test/site-list.test.mjs` reads it, since it is the same module.
const SiteListMod = await import("../public/site-list.js");
const SiteList = SiteListMod.default || SiteListMod;

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const chat = read("../public/chat.js");
const worker = read("../worker.js");
const migration = read("../supabase/applied/20260908020158_site_backends_chat_id.sql");
const check = read("../scripts/chat-index-check.sql");

// Whole-line comments blanked, LENGTH PRESERVED so every offset still lines up.
// This file's own prose names the field it is about and so does the Worker's --
// the recorded "prose contains the thing it forbids", which here would let a
// scan find `chat_id` in an explanation of `chat_id` and call the wire correct.
const bare = (s) => s.split("\n").map((l) => (/^\s*\/\//.test(l) ? " ".repeat(l.length) : l)).join("\n");

/** A named function's source, out of a file. */
function fn(head, src) {
  const at = src.indexOf(head);
  assert.ok(at > 0, head + " is gone");
  const end = src.indexOf("\n}", at);
  assert.ok(end > at, head + " has no end");
  return src.slice(at, end + 2);
}

// ── THE SHAPE RULE ──────────────────────────────────────────────────────────

test("cleanChatId refuses rather than coerces, and bounds what may be stored", () => {
  const good = "site_1757000000000_abcde";
  assert.equal(cleanChatId(good), good);
  assert.equal(cleanChatId("  " + good + "  "), good, "a trimmed id is still the id");

  // `String(["a"])` is `"a"` -- shipped as a real bug three times here, on a
  // role, an access level and a language. This value decides WHICH SITE a
  // customer is answered with, so a coerced one binds a site to a chat that
  // does not exist.
  assert.equal(cleanChatId([good]), "", "an array of one string was coerced to it");
  assert.equal(cleanChatId({ toString: () => good }), "", "an object was coerced");
  assert.equal(cleanChatId(null), "");
  assert.equal(cleanChatId(undefined), "");
  assert.equal(cleanChatId(7), "");
  assert.equal(cleanChatId(true), "");

  assert.equal(cleanChatId("short"), "", "five characters is not a mint's output");
  assert.equal(cleanChatId("x".repeat(65)), "", "an unbounded id reaches a database column");
  assert.equal(cleanChatId("x".repeat(64)), "x".repeat(64), "the ceiling is inclusive");
  assert.equal(cleanChatId("site_1757 000_abc"), "", "a space is not an identifier");
  assert.equal(cleanChatId("site';drop--"), "", "punctuation is refused whole");
  assert.equal(cleanChatId(""), "");
});

test("DRIVEN: the real mint in chat.js passes the rule the Worker enforces", () => {
  // THE DRIFT THIS CLOSES IS THE WHOLE REASON THE RULE IS BOUNDED RATHER THAN
  // PINNED. `CHAT_ID_RE` deliberately does not know about `site_`, because the
  // mint lives in a file the Worker cannot import -- so a future mint that
  // changed shape would stop binding SILENTLY, builds still working and simply
  // no longer belonging to their chat. The rule cannot see the mint, so the
  // SUITE does: the mint is evaluated out of chat.js and its real output run
  // through the real refusal.
  const line = /const id = ('site_' \+ Date\.now\(\)[^;]+);/.exec(chat);
  assert.ok(line, "siteCreate's mint moved or changed shape -- re-derive this before re-anchoring");
  const mint = new Function("return (" + line[1] + ");");
  for (let i = 0; i < 200; i++) {
    const id = mint();
    assert.equal(cleanChatId(id), id,
      "the browser mints an id the Worker refuses, so no build would ever bind: " + id);
  }
  // And the observer is alive: the same expression really does vary, so the 200
  // above are 200 samples and not one value read 200 times.
  assert.ok(new Set([mint(), mint(), mint()]).size > 1, "the mint is a constant");
});

test("the column is spelled once, and the migration and the check agree about the index", () => {
  assert.equal(CHAT_COLUMN, "chat_id");
  // The migration is what ran; the check script is what proves it. Two files
  // naming one index by hand is "two lists of the same thing", so they are held
  // equal here rather than left to agree by luck.
  const idx = /create unique index if not exists (\w+)/.exec(migration);
  assert.ok(idx, "the migration no longer creates the index");
  assert.equal(idx[1], "site_backends_uid_chat_uniq");
  assert.ok(check.includes(idx[1]),
    "the check script proves an index the migration does not create");
  assert.match(migration, /on public\.site_backends \(uid, chat_id\)\s*\n\s*where chat_id is not null/,
    "the index is no longer partial and scoped to the owner -- an unbound site would now collide with every other unbound site");
  assert.match(migration, new RegExp("add column if not exists " + CHAT_COLUMN + " text"),
    "the migration does not add the column the code writes");
  // NULLABLE, and it stays that way: the 57 sites that existed cannot be
  // attached to any chat, and the owner's decision is that they stay loose.
  assert.doesNotMatch(migration, /chat_id text not null|set not null/i,
    "a not-null column would refuse every site that predates the binding");
});

// ── THE WIRE ────────────────────────────────────────────────────────────────

test("DRIVEN: a build posts the chat it was asked in, and a revise does not", () => {
  // EVALUATED, NOT READ. A field that appears in the file and never reaches the
  // body is this session's own bug one commit back, and the reason the picker
  // guard was written the same way.
  const send = fn("function reactSend(", bare(chat));
  const m = /const body = (mode === 'build'[\s\S]*?);\n/.exec(send);
  assert.ok(m, "reactSend no longer composes its body as one expression -- re-derive this window");
  const make = new Function("mode", "t", "imgs", "buildPicker", "qa", "site", "origin",
    "return (" + m[1] + ");");

  const built = make("build", "a barber shop", [], "grok", [], {}, "site_1757000000000_abcde");
  assert.equal(built.chat, "site_1757000000000_abcde",
    "the build POST does not carry the chat, so nothing the server does can bind the site to it");
  // And what it carries is the workspace's own id, not something assembled at
  // the call site: the value handed in as `origin` comes out unchanged.
  assert.equal(built.chat, "site_1757000000000_abcde");

  const revised = make("revise", "make it blue", [], "grok", [], { slug: "fretwork-1" }, "site_OTHER_chat");
  assert.equal(revised.chat, undefined,
    "a revise carries a chat -- a revise names its slug already, and one sent from a second workspace would re-bind the site away from the first");
  assert.equal(revised.slug, "fretwork-1", "the observer is alive: the revise branch still composes a body");
});

// ── THE ROUTE ───────────────────────────────────────────────────────────────

const UID = "11111111-1111-1111-1111-111111111111";
const ENV = { SUPABASE_SERVICE_KEY: "svc", NEON_API_KEY: "k", ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k" };

/**
 * The build route, up to the point where it would start spending.
 *
 * `lookup` is what `site_backends` answers the chat query with; every ledger and
 * model call is a tripwire, so a short-circuit that did not short-circuit
 * announces itself as a recorded call rather than as a mystery status.
 */
async function build({ body, lookup = [], lookupStatus = 200 } = {}) {
  const w = await loadWorker();
  const spent = [];
  const asked = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    if (u.includes("/auth/v1/user")) return json({ id: UID, email: "o@example.com" });
    if (u.includes("/rest/v1/site_backends")) {
      asked.push({ url: u, method: (init && init.method) || "GET" });
      return lookupStatus === 200 ? json(lookup) : new Response("x", { status: lookupStatus });
    }
    if (u.includes("/rest/v1/rpc/credit_debit") || u.includes("/rest/v1/rpc/use_credits")) {
      spent.push(u);
      return json({ ok: true, exempt: false, taken: 2, balance: 500, repeat: false });
    }
    if (u.includes("/rest/v1/rpc/use_quota")) return json(true);
    if (u.includes("/v1/messages") || u.includes("/v1/chat/completions")) {
      spent.push(u);
      throw new Error("the route reached a model");
    }
    return new Response("not stubbed", { status: 503 });
  };
  try {
    const req = new Request("https://gofarther.dev/api/site/react-build", {
      method: "POST",
      headers: { Authorization: "Bearer t", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const res = await w.fetch(req, ENV, makeCtx());
    return { status: res.status, json: await res.json().catch(() => null), spent, asked };
  } finally { globalThis.fetch = real; }
}

const ROW = { slug: "hearth-paper", neon_db: "", brief: "a stationery shop" };

test("DRIVEN: a second build in one chat opens the site it already has, and spends nothing", async () => {
  const r = await build({
    body: { brief: "a stationery shop", chat: "site_1757000000000_abcde" },
    lookup: [ROW],
  });
  assert.equal(r.status, 200, "the retry did not answer as a success: " + JSON.stringify(r.json));
  assert.equal(r.json.ok, true);
  assert.equal(r.json.slug, "hearth-paper", "the answer does not name the site the chat already owns");
  assert.equal(r.json.reused, true);
  assert.equal(r.json.cost, 0);
  assert.equal(r.json.backend, false, "an empty connection was read as a database");
  assert.match(r.json.notes, /already have a site in this chat/i);
  // THE PROPERTY THE OWNER ASKED FOR, in as many words: not a second paid build
  // of the thing they are looking at.
  assert.deepEqual(r.spent, [], "the retry reached a ledger or a model: " + r.spent.join(", "));
  // And it passes the browser's own success gate, so the workspace records it
  // exactly as it records a fresh build -- which is the point.
  assert.ok(r.json.ok && r.json.error !== true && r.json.slug, "the reused answer fails chat.js's success gate");
  // PARSED, NEVER STRING-MATCHED. `https://host//menu` parses as the host
  // `menu` under protocol-relative rules, so a wrong address does not name a
  // wrong page of the site -- it names a different site. And the address here is
  // whatever `publicUrlFor` really resolved (a renamed site answers at its
  // current name), so what is asserted is that it names THIS site rather than
  // one particular spelling.
  assert.ok(r.json.url, "the answer carries no address for the browser to open");
  const u = new URL(r.json.url, "https://gofarther.dev");
  assert.ok(u.host === "hearth-paper.gofarther.app" || u.pathname === "/s/hearth-paper/",
    "the answer's address does not name the site the chat owns: " + r.json.url);
});

test("DRIVEN: a chat with no site builds, and the lookup is uid-scoped and chat-scoped", async () => {
  const r = await build({ body: { brief: "a barber shop", chat: "site_1757000000000_abcde" }, lookup: [] });
  assert.notEqual(r.status, 200, "an empty chat short-circuited into a site that does not exist");
  const q = r.asked.find((a) => a.method === "GET" && a.url.includes(CHAT_COLUMN + "=eq."));
  assert.ok(q, "the route never asked which site this chat has");
  assert.ok(q.url.includes("uid=eq." + UID),
    "the chat lookup is not scoped to the caller -- it could answer with a stranger's site: " + q.url);
  assert.ok(q.url.includes(CHAT_COLUMN + "=eq.site_1757000000000_abcde"),
    "the lookup does not filter on the chat that was sent: " + q.url);
  assert.ok(r.spent.length > 0, "the observer is alive: a real build was on its way to spending");
});

test("DRIVEN: a lookup that could not answer BUILDS -- cannot-tell never reads as there-is-one", async () => {
  // Wrong this way costs a duplicate build the customer can see. Wrong the other
  // way hands somebody the wrong site and charges nothing to find out, which is
  // the failure with no tell at all.
  const r = await build({
    body: { brief: "a barber shop", chat: "site_1757000000000_abcde" },
    lookupStatus: 500,
  });
  assert.notEqual(r.json && r.json.reused, true, "an unreadable lookup answered somebody a site");
  assert.ok(r.spent.length > 0, "an unreadable lookup stopped the build instead of proceeding");
});

test("DRIVEN: a build with no chat is exactly the build of yesterday", async () => {
  // Every site that exists, an older browser, the harnesses and every curl.
  const r = await build({ body: { brief: "a barber shop" }, lookup: [ROW] });
  assert.notEqual(r.json && r.json.reused, true, "a build with no chat was answered somebody else's site");
  assert.equal(r.asked.filter((a) => a.method === "GET" && a.url.includes(CHAT_COLUMN + "=eq.")).length, 0,
    "a build with no chat still asked the chat lookup");
  assert.ok(r.spent.length > 0, "the observer is alive");
});

test("DRIVEN: a revise is never short-circuited, whatever chat it names", async () => {
  // A revise names its slug, which already says which site it is. Intercepting
  // one would answer a revise with the site it was revising and quietly do
  // nothing -- doing less than was asked while reporting success.
  const r = await build({
    body: { slug: "hearth-paper", instruction: "make the header blue", chat: "site_1757000000000_abcde" },
    lookup: [ROW],
  });
  assert.notEqual(r.json && r.json.reused, true, "a revise was answered as a retry and changed nothing");
});

// ── THE TWO WRITERS ─────────────────────────────────────────────────────────

test("both claim paths write the chat, and OMIT it when there is none", () => {
  const w = bare(worker);
  // The frontend-only first build and the with-database one. Both must write it,
  // and cutting either leaves the other perfect and half the platform unbound --
  // the wiring trap, which is why they are counted rather than sampled.
  const spread = [...w.matchAll(/\.\.\.\(chatId \? \{ \[CHAT_COLUMN\]: chatId \} : \{\}\)/g)];
  assert.equal(spread.length, 2,
    "expected exactly two writers of the chat column (claimSiteSlug and saveBackend); found " + spread.length);

  // OMITTED, never written as null or "". The index is `where chat_id is not
  // null`, so an absent value is what keeps every unbound site outside the
  // constraint; a literal null would be the same, but `""` would make every
  // unbound site collide with every other one on the same account.
  assert.doesNotMatch(w, new RegExp("\\[CHAT_COLUMN\\]: chatId \\|\\| \\\"\\\""),
    "an absent chat is written as the empty string, which the partial index treats as a real value");

  // And each writer is the one it should be: named, not just counted.
  assert.match(fn("async function claimSiteSlug(", w), /\.\.\.\(chatId \? \{ \[CHAT_COLUMN\]: chatId \} : \{\}\)/,
    "the frontend-only claim no longer records the chat");
  const ensure = fn("async function ensureSiteBackend(", w);
  assert.match(ensure, /saveBackend:[\s\S]*?\.\.\.\(chatId \? \{ \[CHAT_COLUMN\]: chatId \} : \{\}\)/,
    "the with-database claim no longer records the chat");

  // BOTH TAKE IT AS AN ARGUMENT THAT DEFAULTS TO NONE, so the addon route's own
  // call -- which makes a database for a site that already exists, whose binding
  // was settled when it was built -- keeps passing nothing.
  assert.match(w, /async function claimSiteSlug\(env, slug, uid, brief, chatId = ""\)/);
  assert.match(w, /async function ensureSiteBackend\(env, slug, uid, brief, mark, chatId = ""\)/);
});

test("only a first build hands the chat to a writer, and both build call sites do", () => {
  const w = bare(worker);
  // DEPTH-AWARE, because `\(([^)]*)\)` stops at the first `)` -- which here is
  // inside `(n) => tr.at(...)`, an argument of the very call being counted. The
  // recorded flat-scan trap, met on this guard's first run: it read the
  // with-database call site as having no chat and reported a correct hop broken.
  function argsAt(src, at) {
    let depth = 0;
    for (let i = at; i < src.length; i++) {
      if (src[i] === "(") { if (++depth === 1) at = i + 1; }
      else if (src[i] === ")") { if (--depth === 0) return src.slice(at, i); }
    }
    assert.fail("an unbalanced call at " + at);
  }
  const calls = [...w.matchAll(/(ensureSiteBackend|claimSiteSlug)\(/g)]
    .map((m) => ({ fn: m[1], args: argsAt(w, m.index + m[1].length) }))
    .filter((c) => !c.args.startsWith("env, slug, uid, brief")); // the declarations
  assert.ok(calls.length >= 3, "expected at least three call sites; found " + calls.length);
  const binding = calls.filter((c) => /\bchatId\b/.test(c.args));
  assert.equal(binding.length, 2,
    "expected exactly two call sites to hand the chat in (the build's two claim paths); found " + binding.length +
    " -- " + calls.map((c) => c.fn + "(" + c.args + ")").join(" | "));
  assert.ok(binding.some((c) => c.fn === "ensureSiteBackend"), "the with-database build no longer binds");
  assert.ok(binding.some((c) => c.fn === "claimSiteSlug"), "the frontend-only build no longer binds");
  // The addon's own provision passes none, deliberately, and that absence is
  // asserted beside a presence so the check would fail on a call deleted whole.
  assert.ok(calls.some((c) => c.fn === "ensureSiteBackend" && !/\bchatId\b/.test(c.args)),
    "no unbinding call site remains -- the addon route's provision should pass none");
});

test("the chat is read from the request ONCE, on a first build, through the refusal", () => {
  const w = bare(worker);
  const reads = [...w.matchAll(/cleanChatId\(/g)];
  assert.equal(reads.length, 1, "the chat id is read in more than one place: " + reads.length);
  assert.match(w, /const chatId = firstBuild \? cleanChatId\(body\.chat\) : "";/,
    "the chat is no longer read only on a first build, through the refusal");
  // NEVER `body.chat` raw anywhere else: a second reader that skipped the
  // refusal would be the coercion bug at the one hop that decides which site a
  // customer is answered with.
  const raw = [...w.matchAll(/body\.chat\b/g)];
  assert.equal(raw.length, 1, "body.chat is read somewhere that is not the refusal: " + raw.length);
});

test("the two collisions are told apart, and an unreadable lookup keeps the older sentence", async () => {
  // DRIVEN, both functions together, against one fake wire. `resolution=ignore-
  // duplicates` is `ON CONFLICT DO NOTHING` with no target, so once the chat
  // index exists an empty representation means the slug is taken OR this chat
  // already has a site -- and left undistinguished the second would have told a
  // customer "that name is taken by another account" about their OWN site under
  // a name nobody else holds. The recorded "a failure that cannot name itself",
  // arriving the same day the constraint does.
  const w = bare(worker);
  const src = fn("async function siteForChat(", w) + "\n" + fn("async function claimSiteSlug(", w);
  const make = new Function("SUPABASE_URL", "svcHeaders", "CHAT_COLUMN", "fetch", "AbortSignal",
    src + "\nreturn claimSiteSlug;");

  async function claim({ rows, chatRows, chatStatus = 200 }) {
    const seen = [];
    const claimFn = make("https://sb.example", () => ({}), CHAT_COLUMN,
      async (url, init) => {
        const u = String(url);
        seen.push(u);
        if ((init && init.method) === "POST") {
          return new Response(JSON.stringify(rows), { status: 200, headers: { "content-type": "application/json" } });
        }
        return chatStatus === 200
          ? new Response(JSON.stringify(chatRows), { status: 200, headers: { "content-type": "application/json" } })
          : new Response("x", { status: chatStatus });
      },
      { timeout: () => undefined });
    try {
      const ok = await claimFn({}, "hearth-paper", UID, "b", "site_1757000000000_abcde");
      return { ok, seen };
    } catch (e) { return { err: e, seen }; }
  }

  const written = await claim({ rows: [{ slug: "hearth-paper" }] });
  assert.equal(written.ok, true, "a claim that wrote its row did not succeed");

  const chatTaken = await claim({ rows: [], chatRows: [{ slug: "hearth-paper" }] });
  assert.ok(chatTaken.err, "an empty representation was read as a successful claim");
  assert.equal(chatTaken.err.chat, true, "a chat collision is not marked as one");
  assert.equal(chatTaken.err.slug, "hearth-paper", "the refusal does not name the site the customer already has");
  assert.match(String(chatTaken.err.message), /this chat already has a site/);

  const nameTaken = await claim({ rows: [], chatRows: [] });
  assert.ok(nameTaken.err, "a taken name was read as a successful claim");
  assert.notEqual(nameTaken.err.chat, true, "a taken name was reported as a chat collision");
  assert.match(String(nameTaken.err.message), /that name is taken/);

  // CANNOT-TELL KEEPS THE OLDER SENTENCE. The slug conflict is the one that was
  // always possible, so a lookup that failed answers the thing that is more
  // likely true rather than inventing a site the customer may not have.
  const blind = await claim({ rows: [], chatStatus: 500 });
  assert.ok(blind.err, "an unreadable lookup was read as a successful claim");
  assert.notEqual(blind.err.chat, true, "an unreadable lookup claimed the customer has a site in this chat");
  assert.match(String(blind.err.message), /that name is taken/);
});

// ── THE LIST, AND THE MERGE ─────────────────────────────────────────────────

async function callList({ backends = [], aliases = [], builds = [] } = {}) {
  const w = await loadWorker();
  const asked = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const u = String((input && input.url) || input || "");
    const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } });
    if (u.includes("/auth/v1/user")) return json({ id: UID, email: "o@example.com" });
    if (u.includes("/rest/v1/site_backends")) { asked.push(u); return json(backends); }
    if (u.includes("/rest/v1/site_aliases")) return json(aliases);
    if (u.includes("/rest/v1/site_builds")) return json(builds);
    return new Response("unavailable", { status: 503 });
  };
  try {
    const req = new Request("https://gofarther.dev/api/site/list", { headers: { Authorization: "Bearer t" } });
    const res = await w.fetch(req, { SUPABASE_SERVICE_KEY: "svc" }, makeCtx());
    return { status: res.status, body: await res.json().catch(() => null), asked };
  } finally { globalThis.fetch = real; }
}

test("DRIVEN: the list selects the chat and hands it back, and an unbound site says so", async () => {
  const r = await callList({
    backends: [
      { slug: "hearth-paper", created_at: "2026-09-08T01:00:00Z", brief: "b", neon_db: "", chat_id: "site_1757000000000_abcde" },
      { slug: "fretwork-1", created_at: "2026-09-01T00:00:00Z", brief: "b", neon_db: "postgres://x" },
    ],
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.asked[0].includes(CHAT_COLUMN),
    "the list no longer selects the chat, so nothing the browser does can put a site back in its workspace: " + r.asked[0]);
  const [bound, loose] = r.body.sites;
  assert.equal(bound.chat, "site_1757000000000_abcde");
  assert.equal(loose.chat, "", "an unbound site is not spelled as an empty string");
  // AND THE CONNECTION NEVER LEAVES. The row is selected with `neon_db` on it
  // because the boolean is derived from it; the whole payload is searched, since
  // a field-level check passes the day somebody spreads the row.
  const wire = JSON.stringify(r.body);
  assert.ok(!wire.includes("postgres://"), "a connection string reached the browser");
  assert.ok(!wire.includes("neon_db"), "the column name reached the browser");
});

test("the merge puts a site back in the workspace that built it", () => {
  // THE BUG, EXACTLY. A build whose answer never came back leaves a local record
  // with a thread, a name and NO slug; the server has the site with its chat on
  // it. Matched by slug alone those are two cards -- the workspace still looking
  // unfinished, and the finished site beside it as a stranger.
  const local = [{ id: "site_1757000000000_abcde", name: "Hearth Paper", slug: "", thread: [{ role: "user", text: "a stationery shop" }] }];
  const server = [{ slug: "hearth-paper", name: "hearth-paper", url: "https://hearth-paper.gofarther.app/", createdAt: 1, chat: "site_1757000000000_abcde" }];

  const merged = SiteList.merge(local, server, true);
  assert.equal(merged.length, 1, "the same workspace was shown twice -- once finished, once still spinning");
  assert.equal(merged[0].id, "site_1757000000000_abcde", "the adopted record lost its own id, so the workspace stopped being the workspace");
  assert.equal(merged[0].slug, "hearth-paper", "the server's slug did not reach the record");
  assert.deepEqual(merged[0].thread, local[0].thread, "the conversation was dropped");
  assert.equal(merged[0].name, "Hearth Paper", "the local name lost to the slug-ish server one");
});

test("the merge is unchanged for every site that is not bound", () => {
  // The 57 that exist, and every build that sends no chat. This is the control:
  // without it a merge that matched EVERYTHING by chat would pass the case above.
  const local = [
    { id: "site_A", name: "Fretwork", slug: "fretwork-1", thread: [1] },
    { id: "site_B", name: "In flight", slug: "" },
  ];
  const server = [{ slug: "fretwork-1", name: "fretwork-1", url: "u", createdAt: 1 }];

  const merged = SiteList.merge(local, server, true);
  assert.equal(merged.length, 2, "the in-flight build was dropped or doubled");
  assert.equal(merged[0].slug, "fretwork-1");
  assert.equal(merged[0].name, "Fretwork", "the slug match stopped preferring the local record");
  assert.equal(merged[1].id, "site_B", "a slugless record with no chat match is no longer kept as a build in flight");
});

test("the merge prefers the slug, and never matches a chat the server did not name", () => {
  // SLUG FIRST: it is what the two records are actually about. A workspace whose
  // record already carries it needs nothing else, and a chat fallback that
  // outranked it would move a site into the wrong workspace on a collision.
  const local = [
    { id: "site_A", name: "Right one", slug: "fretwork-1" },
    { id: "site_B", name: "Wrong one", slug: "" },
  ];
  const server = [{ slug: "fretwork-1", name: "fretwork-1", url: "u", createdAt: 1, chat: "site_B" }];
  const merged = SiteList.merge(local, server, true);
  assert.equal(merged[0].name, "Right one", "the chat match outranked the slug match");

  // AND AN UNBOUND SERVER ROW ADOPTS NOTHING. `made.chat` is `""` for every
  // existing site, and `byChat[""]` must never be consulted -- a local record
  // with no id would otherwise be adopted by the first unbound site listed.
  const orphan = SiteList.merge(
    [{ id: "", name: "No id", slug: "" }],
    [{ slug: "hearth-paper", name: "hearth-paper", url: "u", createdAt: 1 }],
    true,
  );
  assert.equal(orphan.length, 2, "an unbound server row adopted a record with no chat id");
  assert.equal(orphan[0].name, "hearth-paper", "the server row lost its own identity to a stranger");
});

test("a server list that could not be read is still not an empty one", () => {
  // The rule the start screen already keeps, re-asserted here because this
  // change touched the same function: a blip, an outage or a signed-out visitor
  // must leave the local list standing rather than emptying the screen.
  const local = [{ id: "site_A", name: "Fretwork", slug: "fretwork-1" }];
  // `ok` is the third argument: whether the server was actually asked AND
  // answered. `false` is the blip; `[]` with `ok` is an account that owns
  // nothing, and the two are spelled apart at every hop for exactly this reason.
  assert.deepEqual(SiteList.merge(local, null, false), local, "an unreadable list emptied the screen");
  assert.deepEqual(SiteList.merge(local, [], false), local, "a failed read was treated as an empty account");
  assert.deepEqual(SiteList.merge(local, [], true), [], "an account that owns nothing is not the same as a list nobody could read");
});
