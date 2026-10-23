// decide-sec-12 (2026-10-23): the owner's choices for audit A16-4 (#140) and
// A16-7 (#142). Record: docs/history/2026-10-23-decide-sec-12.md.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gatewayKey, signJobToken, verifyJobToken, gatewayHandler, sbDecision } from "../builder/job-gateway.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";

const SB_URL = "https://sb.example";
const KEY = "service-key";
const MINT = "mint";
const JOB = { id: "j_edit00000001", slug: "fretwork-1", uid: "22175f41-6fbf-49d7-b039-a65078a0141c", exp: 1_900_000_000 };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

// `aliases` answers the alias-row read, `sites` the site_backends read.
async function rig({ aliases = () => json([]), sites = () => json([]) } = {}) {
  const key = await gatewayKey("platform-secret");
  const token = await signJobToken(JOB, key);
  const calls = [];
  const fetch = async (url, init) => {
    const u = String(url);
    calls.push({ url: u, method: init && init.method, headers: Object.fromEntries(new Headers(init && init.headers).entries()), body: init && init.body });
    if (init && init.method === "GET" && u.includes("/rest/v1/site_aliases?")) return aliases(u);
    if (init && init.method === "GET" && u.includes("/rest/v1/site_backends?")) return sites(u);
    return json({ ok: true });
  };
  const handle = gatewayHandler({ bucket: null, verify: (t) => verifyJobToken(t, key, 1_000_000_000_000), sb: { url: SB_URL, key: KEY, mint: MINT, fetch } });
  const send = (path, init = {}) => handle(new Request("https://gofarther.dev/api/job/" + JOB.id + path, { ...init, headers: { authorization: "Bearer " + token, ...(init.headers || {}) } }), JOB.id);
  const post = (rows, qs = "") => send("/sb/rest/v1/site_aliases" + qs, { method: "POST", headers: { "content-type": "application/json", prefer: "resolution=merge-duplicates" }, body: JSON.stringify(rows) });
  return { send, post, calls, writes: () => calls.filter((c) => c.method === "POST") };
}

test("A16-4: an unused alias equal to ANOTHER site's storage name is refused and never written", async () => {
  const r = await rig({ sites: () => json([{ slug: "other-1" }]) });
  const res = await r.post({ alias: "other-1", slug: JOB.slug, uid: JOB.uid, current: true });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).why, "claim");
  assert.equal(r.writes().length, 0, "the write reached Supabase");
  const read = r.calls.find((c) => c.url.includes("/rest/v1/site_backends?"));
  assert.ok(read, "the storage-name read was never made");
  assert.match(read.url, /site_backends\?slug=in\.\(%22other-1%22\)&select=slug$/);
  assert.equal(read.headers.apikey, KEY);
});

test("A16-4: the storage-name check fails closed (a failed read, a thrown read, a body that is not a list)", async () => {
  for (const sites of [() => json([], 500), () => { throw new TypeError("fetch failed"); }, () => json({ slug: "fretwork-1" })]) {
    const r = await rig({ sites });
    const res = await r.post({ alias: "brand-new", slug: JOB.slug, uid: JOB.uid });
    assert.equal(res.status, 403);
    assert.equal(r.writes().length, 0);
  }
});

test("A16-4: a claiming write takes no query, so `on_conflict` cannot move the merge to another column", () => {
  const row = JSON.stringify({ alias: "bakery", slug: JOB.slug, uid: JOB.uid, current: true });
  assert.deepEqual(sbDecision(JOB, "POST", "/rest/v1/site_aliases", "?on_conflict=slug", row, MINT), { ok: false, why: "query:on_conflict" });
  assert.deepEqual(sbDecision(JOB, "POST", "/rest/v1/site_aliases", "?columns=alias", row, MINT), { ok: false, why: "query:columns" });
  assert.equal(sbDecision(JOB, "POST", "/rest/v1/site_aliases", "", row, MINT).ok, true);
});

test("A16-4: a merge onto another site's alias row is still refused (A33-9)", async () => {
  const r = await rig({ aliases: () => json([{ alias: "bakery", slug: "other-1" }]) });
  assert.equal((await r.post({ alias: "bakery", slug: JOB.slug, uid: JOB.uid })).status, 403);
  assert.equal(r.writes().length, 0);
});

test("A16-4: a container rename still works: both rows, merge-duplicates, its own storage name allowed", async () => {
  const r = await rig({ aliases: () => json([{ alias: "old-name", slug: JOB.slug }]), sites: () => json([{ slug: JOB.slug }]) });
  // demote then promote, as `renameRows` writes them; the promote is back to the site's own slug.
  assert.equal((await r.post({ alias: "old-name", slug: JOB.slug, uid: JOB.uid, current: false })).status, 200);
  assert.equal((await r.post({ alias: JOB.slug, slug: JOB.slug, uid: JOB.uid, current: true })).status, 200);
  assert.equal(r.writes().length, 2);
  assert.equal(r.writes()[1].headers.prefer, "resolution=merge-duplicates");
  assert.equal(r.writes()[1].url, SB_URL + "/rest/v1/site_aliases");
});

// ── A16-7 ────────────────────────────────────────────────────────────────────
const OP = "22175f41-6fbf-49d7-b039-a65078a0141c";
const STRANGER = "00000000-0000-4000-8000-0000000000aa";
const PROBES = [
  ["GET", "/api/_slow?ms=0"],
  ["GET", "/api/_hold?check=1"],
  ["GET", "/api/_egress"],
  ["GET", "/api/site/job-probe?id=probe-abcd1234"],
  ["POST", "/api/site/job-probe"],
];

async function press(method, path, { uid, env: extra = {}, token = "t" } = {}) {
  const worker = await loadWorker();
  const real = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const u = String((input && input.url) || input || "");
    if (u.includes("/auth/v1/user")) return uid ? json({ id: uid, email: "x@example.com" }) : json({ msg: "bad jwt" }, 401);
    return new Response("unavailable", { status: 503 });
  };
  const instance = { fetch: async () => json({ ok: true, idle: true }) };
  const env = { SITE_BUILD_CONTAINER: { idFromName: (n) => ({ name: n, toString: () => n }), get: () => instance }, SITE_SECRETS_KEY: "x".repeat(48), SUPABASE_SERVICE_KEY: "k", ...extra };
  try {
    const init = { method, headers: { ...(token ? { authorization: "Bearer " + token } : {}), "content-type": "application/json" } };
    if (method === "POST") init.body = JSON.stringify({ probe: "env" });
    return await worker.fetch(new Request("https://gofarther.dev" + path, init), env, makeCtx());
  } finally { globalThis.fetch = real; }
}

test("A16-7: every probe route refuses a signed-in account not on OPERATOR_UIDS, and everyone when it is unset, empty, `-` or a wildcard", async () => {
  for (const [m, p] of PROBES) {
    for (const extra of [{}, { OPERATOR_UIDS: "" }, { OPERATOR_UIDS: "-" }, { OPERATOR_UIDS: OP }, { OPERATOR_UIDS: "*" }]) {
      const res = await press(m, p, { uid: STRANGER, env: extra });
      assert.equal(res.status, 403, `${m} ${p} with ${JSON.stringify(extra)} answered ${res.status}`);
    }
    assert.equal((await press(m, p, { uid: null, token: "" })).status, 401, `${m} ${p} signed out`);
  }
});

test("A16-7: a listed operator reaches every probe route (comma or space separated, any case)", async () => {
  for (const [m, p] of PROBES) {
    for (const list of [OP, "11111111-1111-4111-8111-111111111111, " + OP.toUpperCase(), "junk " + OP]) {
      const res = await press(m, p, { uid: OP, env: { OPERATOR_UIDS: list } });
      assert.ok(res.status !== 401 && res.status !== 403, `${m} ${p} refused the operator (${list}): ${res.status}`);
    }
  }
});

test("A16-7: build-health stays open to any signed-in owner (the canary's free check is not gated)", async () => {
  const res = await press("GET", "/api/site/build-health", { uid: STRANGER, env: {} });
  assert.equal(res.status, 200);
});

test("A16-7: OPERATOR_UIDS is uploaded by the deploy with a non-empty fallback", () => {
  const yml = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
  assert.match(yml, /\n {12}OPERATOR_UIDS\n/, "not in the secrets: list");
  assert.match(yml, /\n {10}OPERATOR_UIDS: \$\{\{ secrets\.OPERATOR_UIDS \|\| '-' \}\}\n/);
});
