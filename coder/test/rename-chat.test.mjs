// RENAMING A CHAT (live test 2026-11-15: the owner told Coder "hey, name this chat testing"; Claude Code renames its
// session, Coder could not): Coder's rename_chat tool, the Worker's POST /projects/:id, and the title's ▾ menu on the page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const call = (name, args, id = "c1") => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k), json: async () => JSON.parse(m.get(k)) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { for (const x of [].concat(k)) m.delete(x); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}

test("RN1 rename_chat: offered to Coder (not from GitHub, not to Gloopy), named in CODER_SYSTEM, its title checked, a 'renamed' step, and the title in the turn's result", async () => {
  const A = await import("../container/coder-agent.mjs");
  assert.ok(A.CODER_TOOLS.some((t) => t.function.name === "rename_chat"));
  assert.ok(!A.GITHUB_TOOLS.some((t) => t.function.name === "rename_chat"));
  assert.match(A.CODER_SYSTEM, /rename_chat \(renames this chat, only when asked\)/);
  assert.equal(A.chatTitleOf("  testing \n "), "testing");
  assert.equal(A.chatTitleOf("a\u0000b"), "a b");
  assert.equal(A.chatTitleOf(""), "");
  assert.equal(A.chatTitleOf("x".repeat(81)), "");
  assert.equal(A.chatTitleOf("x".repeat(80)), "x".repeat(80));

  const events = []; const seen = []; let n = 0;
  const steps = [say("", [call("rename_chat", { title: "" }, "r0"), call("rename_chat", { title: "  testing  " }, "r1")]), say("This chat is now named “testing”.")];
  const r = await A.runCoder({ send: async (q) => { seen.push(q); return steps[Math.min(n++, 1)]; }, emit: (e) => events.push(e), exec: async () => ({ code: 0, output: "" }) }, { text: "hey, name this chat testing" });
  assert.equal(r.sessionTitle, "testing");
  assert.deepEqual(events.filter((e) => e.type === "renamed").map((e) => e.text), ["testing"]);
  const answers = seen[1].messages.filter((m) => m.role === "tool").map((m) => m.content);
  assert.ok(answers.some((a) => /error: give a title of 1 to 80 characters/.test(a)));
  assert.ok(answers.some((a) => /ok: this chat is now named “testing”/.test(a)));

  // From GitHub it refuses if called anyway, and the title stays.
  const g = []; let k = 0;
  const gs = [say("", [call("rename_chat", { title: "pwned" })]), say("No.")];
  const r2 = await A.runCoder({ send: async (q) => { g.push(q); return gs[Math.min(k++, 1)]; }, emit: () => {}, exec: async () => ({ code: 0, output: "" }) }, { text: "x", github: true });
  assert.equal(r2.sessionTitle, undefined);
  const gloopy = await import("../container/gloopy-agent.mjs");
  assert.ok(!(gloopy.HELPER_TOOLS || []).some((t) => t.function.name === "rename_chat"));
});

test("RN2 POST /projects/:id renames the owner's own chat: 1-80 characters of plain text; another account's chat is not found", async () => {
  const { handleCoder } = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y,you@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket };
  const uid = "user-1234567890abcdef";
  await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
  const fetchFn = async (url) => {
    const u = String(url); const J = (o, status = 200) => new Response(JSON.stringify(o), { status });
    if (u === "https://api.github.com/repos/ana/shop") return J({ default_branch: "main", permissions: { push: true } });
    return J({ message: "Not Found" }, 404);
  };
  let who = { id: uid, email: "me@x.y" };
  const deps = { fetchFn, authUser: async () => who, container: () => ({ fetch: async () => Response.json({}) }) };
  const go = (path, init = {}) => handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, deps);
  const made = await (await go("projects", { method: "POST", body: JSON.stringify({ repo: "ana/shop" }) })).json();
  const id = made.project.id;
  const rename = (title) => go("projects/" + id, { method: "POST", body: JSON.stringify({ title }) });
  assert.equal((await rename("")).status, 400);
  assert.equal((await rename("   ")).status, 400);
  assert.equal((await rename("x".repeat(81))).status, 400);
  assert.equal((await rename(42)).status, 400);
  const ok = await (await rename("  my\ttesting  chat ")).json();
  assert.equal(ok.project.title, "my testing chat");
  assert.equal((await (await go("projects/" + id)).json()).project.title, "my testing chat", "saved");
  const list = await (await go("projects")).json();
  assert.ok((list.projects || []).some((p) => p.id === id && p.title === "my testing chat"), "the sidebar's list has it");
  who = { id: "user-fedcba0987654321", email: "you@x.y" };
  assert.equal((await rename("mine now")).status, 404, "another account's chat");
  who = { id: uid, email: "me@x.y" };
  assert.equal((await (await go("projects/" + id)).json()).project.title, "my testing chat");
});

test("RN3 the page: the title's ▾ menu with Rename (inline edit, Enter saves, Esc cancels), Coder's 'Renamed chat' step, the new name live; styles only under #gfApp", () => {
  const js = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../public/coder.css", import.meta.url), "utf8");
  assert.match(js, /id="cdTitleMore"[^\n]*▾/);
  assert.match(js, /role="menuitem" id="cdRename">Rename</);
  assert.match(js, /on\('#cdTitleIn', 'keydown'[\s\S]{0,200}e\.key === 'Escape'[\s\S]{0,200}e\.key !== 'Enter'/);
  assert.match(js, /call\('\/projects\/' \+ encodeURIComponent\(S\.project\.id\), \{ method: 'POST', body: JSON\.stringify\(\{ title:/);
  assert.match(js, /e\.type === 'renamed'\) out\.push\([^\n]*Renamed chat/);
  assert.match(js, /e\.type === 'renamed' && e\.text && S\.project\) \{ S\.project\.title = [^\n]*syncEntry\(\); drawSide\(\);/);
  for (const rule of css.match(/^[^\n{]*\.cd-title-(more|menu|wrap|in)[^\n{]*\{/gm) || []) assert.match(rule, /^#gfApp /, rule);
  assert.ok((css.match(/\.cd-title-(more|menu|wrap|in)/g) || []).length >= 5);
});
