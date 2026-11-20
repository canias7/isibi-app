// CLAUDE CODE FIXES, BATCH 27 (2026-11-19), Worker side.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

const M = await import("../src/coder-mentions.mjs");
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs1", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).sort().map((key) => ({ key })), truncated: false }; } };
}
const JOBS = "coder/github-jobs/";
function github() {
  const said = [];
  const fetchFn = async (url, init = {}) => {
    if (/access_tokens$/.test(url)) return new Response(JSON.stringify({ token: "ghs_app" }), { status: 201 });
    said.push([init.method || "GET", String(url).replace("https://api.github.com", ""), init.body ? JSON.parse(init.body).body : null]);
    return new Response(JSON.stringify({ id: 1 }), { status: 200 });
  };
  return { said, fetchFn };
}
const env = (bucket) => ({ CODER_USERS: "me@x.y", CODER_BUCKET: bucket, CODER_GITHUB_APP_ID: "1", CODER_GITHUB_APP_PRIVATE_KEY: privateKey });

test("M-d-43: a running @coder job's \"On it\" comment shows its checklist, only when it changed, never step output; the final answer still replaces it", async () => {
  const b = fakeBucket(), g = github();
  const key = JOBS + "u1__shop-1__900.json";
  await b.put(key, JSON.stringify({ uid: "u1", email: "me@x.y", id: "shop-1", repo: "ana/shop", number: 5, login: "ana", installation: 7, ackId: 900, at: 1000, sentAt: 1000, turn: 1 }));
  let events = [{ type: "user", text: "do it", at: 1000 }, { type: "bash", verb: "Ran", command: "npm test" }, { type: "result", text: "SECRET-OUTPUT 42 passing" }, { type: "todo", items: [{ text: "Fix the bug", status: "done" }, { text: "Running the tests", status: "in_progress" }] }];
  let running = true;
  const coder = async (req) => {
    const u = new URL(req.url);
    if (u.pathname.endsWith("/state")) return Response.json({ running, events, project: { status: running ? "running" : "idle", turn: 1 } });
    return Response.json({ project: { id: "shop-1", branch: "coder/x" }, events: [...events, { type: "done", text: "All fixed." }] });
  };
  await M.runMentionJobs(env(b), { coder, fetchFn: g.fetchFn }, 60_000);
  assert.equal(g.said.length, 1);
  assert.equal(g.said[0][0], "PATCH");
  assert.equal(g.said[0][1], "/repos/ana/shop/issues/comments/900");
  assert.match(g.said[0][2], /^On it, @ana\. Working on `ana\/shop`…\n\n- \[x\] Fix the bug\n- \[ \] Running the tests\n\nFollow along on https:\/\/gofarther\.dev$/);
  assert.doesNotMatch(g.said[0][2], /SECRET-OUTPUT/);
  await M.runMentionJobs(env(b), { coder, fetchFn: g.fetchFn }, 120_000);
  assert.equal(g.said.length, 1, "nothing changed: GitHub is not written to");
  running = false;
  await M.runMentionJobs(env(b), { coder, fetchFn: g.fetchFn }, 180_000);
  assert.equal(g.said.length, 2);
  assert.match(g.said[1][2], /^@ana Done\.\n\nAll fixed\./);
  assert.equal(b.m.has(key), false);
});

test("M-d-43: with no checklist, the last 8 steps' titles show", () => {
  const ev = [{ type: "user" }, ...Array.from({ length: 10 }, (_, k) => ({ type: "bash", verb: "Ran", command: "step " + k }))];
  const t = M.progressText({ login: "ana", repo: "ana/shop" }, ev);
  assert.doesNotMatch(t, /step 1\n/);
  assert.match(t, /- Ran step 2\n[\s\S]*- Ran step 9\n/);
  assert.equal(M.progressText({ login: "ana", repo: "ana/shop" }, [{ type: "user" }]), "");
});

test("L-server-42: GitHub login renewal: two at once renew once; a failed renewal keeps a still-working token; a lapsed one is not connected", async () => {
  const G = await import("../src/coder-github.mjs");
  const env = { CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "x" };
  const b = fakeBucket();
  let sends = 0;
  const slowOk = async () => { sends++; await new Promise((ok) => setTimeout(ok, 50)); return new Response(JSON.stringify({ access_token: "new", refresh_token: "ghr_2", expires_in: 28800 })); };
  await G.saveConnection(env, b, "u1", { access: "old", refresh: "ghr_1", expires: Date.now() + 60_000, refreshExpires: Date.now() + 1e9 }, "ana");
  const [x, y] = await Promise.all([G.userToken(env, b, "u1", { fetchFn: slowOk }), G.userToken(env, b, "u1", { fetchFn: slowOk })]);
  assert.equal(sends, 1, "the one-time renewal token is sent once");
  assert.equal(x.token, "new"); assert.equal(y.token, "new");
  assert.equal(b.m.has("coder/u1/github.renewing.json"), false, "the marker is gone");
  // GitHub's token service fails (502) while the old token still works for a minute: the old one is used.
  const down = async () => new Response("{}", { status: 502 });
  await G.saveConnection(env, b, "u2", { access: "still", refresh: "ghr_1", expires: Date.now() + 60_000, refreshExpires: Date.now() + 1e9 }, "ana");
  assert.equal((await G.userToken(env, b, "u2", { fetchFn: down })).token, "still");
  // Already lapsed: not connected, as before.
  await G.saveConnection(env, b, "u3", { access: "gone", refresh: "ghr_1", expires: Date.now() - 1000, refreshExpires: Date.now() + 1e9 }, "ana");
  assert.equal(await G.userToken(env, b, "u3", { fetchFn: down }), null);
});

test("M-g-23: the setup script box is a Bash editor: line numbers and coloured comments, strings, variables, keywords and commands, all escaped", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  const esc = src.match(/  const esc = [^\n]*\n/)[0];
  const block = src.slice(src.indexOf("  const SH_WORDS"), src.indexOf("  function shRedraw"));
  const { shHighlight, shGutter } = new Function(esc + block + "return { shHighlight, shGutter };")();
  const script = "#!/bin/bash\n# install\nif [ -n \"$HOME\" ]; then\n  npm install '<x>' ${CI}\nfi";
  assert.equal(shGutter(script), "1\n2\n3\n4\n5");
  const h = shHighlight(script);
  assert.match(h, /<span class="sh-com"># install<\/span>/);
  assert.match(h, /<span class="sh-kw">if<\/span>/);
  assert.match(h, /<span class="sh-str">&quot;<span|<span class="sh-str">&quot;\$HOME&quot;<\/span>/);
  assert.match(h, /<span class="sh-cmd">npm<\/span>/);
  assert.match(h, /<span class="sh-str">&#39;&lt;x&gt;&#39;<\/span>/);
  assert.match(h, /<span class="sh-var">\$\{CI\}<\/span>/);
  assert.doesNotMatch(h, /<x>/);
  assert.match(src, /id="envScriptGut"[\s\S]*id="envScriptHl"[\s\S]*id="envScriptIn"/);
});
