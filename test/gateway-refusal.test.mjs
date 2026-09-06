// A KEY THE WALL REFUSED IS A NAMED FAILURE (stage 4a, 2026-09-05, owner:
// "go").
//
// Inside the container the site's storage is the job gateway, whose wall
// admits only the site's own keys. Before this a refused key threw a plain
// error out of `GatewayBucket`, the spine's catch read it as any other
// failure, and the customer was told "our build service was restarting" — a
// failure wearing another failure's sentence, the recorded trap. Now the
// bucket throws a typed error (`code`, `status`, `key`), the spine's stage and
// activation catches carry the code and the key, and `compileMsg` names a
// forbidden write as ours, with the key; a transient one keeps today's
// sentence. `compileMsg` is DRIVEN here, evaluated out of the Worker's source
// with its one free identifier stubbed, so the sentence is read off the
// function rather than off a regex over it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const blank = (s) => s.replace(/^([ \t]*)\/\/.*$/gm, (m) => " ".repeat(m.length));

function compileMsgFn() {
  const at = WORKER.indexOf("function compileMsg(pub, theirs) {");
  const end = WORKER.indexOf("\n}\n", at);
  assert.ok(at > 0 && end > at, "compileMsg moved — rescope this");
  const text = WORKER.slice(at, end + 2);
  // `roomSentence` is the one name the function reads from module scope.
  // eslint-disable-next-line no-new-func
  return new Function("roomSentence", text + "\nreturn compileMsg;")((k) => "room:" + k);
}

test("a forbidden write is named as ours, with the key; a transient one keeps today's sentence", () => {
  const compileMsg = compileMsgFn();
  const theirs = "That didn't compile — try describing it differently.";
  const forbidden = compileMsg({ ok: false, error: "stage", ours: true, code: "forbidden", key: "sitemeta/fretwork-1.json", detail: "gateway put 403 for sitemeta/fretwork-1.json" }, theirs);
  assert.match(forbidden, /our storage refused to write “sitemeta\/fretwork-1\.json”/, forbidden);
  assert.match(forbidden, /nothing was changed/);
  assert.match(forbidden, /This is on us, not your change; nothing was charged\./);
  assert.doesNotMatch(forbidden, /restarting|didn't compile/, "a refused key still wears another failure's sentence");
  // The same on the activation side.
  const act = compileMsg({ ok: false, error: "activate", ours: true, code: "forbidden", key: "current/fretwork-1.json" }, theirs);
  assert.match(act, /refused to write “current\/fretwork-1\.json”/);
  // A refusal with no key still names itself as ours and a refusal.
  assert.match(compileMsg({ ok: false, error: "stage", ours: true, code: "forbidden" }, theirs), /refused to write a file this site needs/);
  // Transient: today's sentence, unchanged.
  const transient = compileMsg({ ok: false, error: "stage", ours: true, code: "transient", key: "builds/fretwork-1/x/client/a.js" }, theirs);
  assert.match(transient, /our build service was restarting/);
  assert.doesNotMatch(transient, /refused/);
  // And the sentences that came before it are untouched: theirs, unbilled,
  // the gate, the room, the clock, the read.
  assert.equal(compileMsg({ ok: false, error: "compile", ours: false }, theirs), theirs);
  assert.match(compileMsg({ ok: false, error: "unbilled", detail: "insufficient" }, theirs), /aren't enough credits/);
  assert.match(compileMsg({ ok: false, error: "not-granted", ours: true, detail: "lease" }, theirs), /couldn't be published \(lease\)/);
  assert.equal(compileMsg({ ok: false, error: "compile", ours: true, room: "full" }, theirs), "room:full");
  assert.match(compileMsg({ ok: false, error: "compile", ours: true, timedOut: true }, theirs), /longer than the time we allow/);
  assert.match(compileMsg({ ok: false, error: "read", ours: true }, theirs), /couldn't read your site's saved design/);
  // A forbidden code is named even when the failure is not a stage — the key
  // is the fact, not the phase — but never over a refusal that is theirs.
  assert.match(compileMsg({ ok: false, error: "compile", ours: true, code: "forbidden", key: "k" }, theirs), /refused to write/);
  assert.equal(compileMsg({ ok: false, error: "compile", ours: false, code: "forbidden", key: "k" }, theirs), theirs);
});

test("the spine's stage and activation catches carry the typed refusal's code and key onto the wire", () => {
  const w = blank(WORKER);
  const at = w.indexOf("async function recompileAndPublish(");
  const spine = w.slice(at, w.indexOf("\nasync function siteRedirectFor(", at));
  assert.ok(spine.length > 20_000, "the spine moved — rescope this");
  // The stage: a throw is caught with its code and key, and the refusal carries both.
  assert.match(spine, /\} catch \(e\) \{ staged = \{ ok: false, error: String\(\(e && e\.message\) \|\| e\), code: \(e && e\.code\) \|\| undefined, key: \(e && e\.key\) \|\| undefined \}; \}/,
    "a stage that threw loses the refusal's code and key");
  assert.match(spine, /return \{ ok: false, error: "stage", ours: true, detail: [^\n]*, code: \(staged && staged\.code\) \|\| undefined, key: \(staged && staged\.key\) \|\| undefined \};/,
    "the stage refusal does not carry the code and the key");
  // The activation: WRAPPED — a store that refuses the pointer write throws
  // out of the module, and before this that throw escaped the spine to the
  // route's catch, which keeps only the error's class.
  const tryAt = spine.indexOf("try {\n  act = await activateBuild(buildDeps(env), {");
  assert.ok(tryAt > 0, "the activation is not inside a try");
  assert.match(spine, /\} catch \(e\) \{ act = \{ ok: false, error: String\(\(e && e\.message\) \|\| e\), code: \(e && e\.code\) \|\| undefined, key: \(e && e\.key\) \|\| undefined \}; \}/,
    "an activation that threw loses the refusal's code and key");
  // RE-ANCHORED 2026-09-06: this quoted the activation refusal's WHOLE line,
  // including the one-reason ternary (`superseded`) it passed through. Two more
  // reasons arrived (`not-served`, `lease-lost`) and the spelling moved. What
  // this case is about is the typed refusal's `code` and `key` reaching the
  // wire, so that is what is asserted, on the same line.
  const actRet = spine.indexOf('return { ok: false, error: act &&', spine.indexOf("if (!act || act.ok !== true) {"));
  assert.ok(actRet > 0, "the activation refusal moved — rescope this");
  const actLine = spine.slice(actRet, spine.indexOf("\n", actRet));
  assert.match(actLine, /code: \(act && act\.code\) \|\| undefined, key: \(act && act\.key\) \|\| undefined \};/,
    "the activation refusal does not carry the code and the key");
  // Both marks carry them too, so the trace says which key without the log.
  assert.match(spine, /tm\("stage", "fail", \{ why: [^\n]*, code: \(staged && staged\.code\) \|\| undefined, key: \(staged && staged\.key\) \|\| undefined \}\);/);
  assert.match(spine, /tm\("activate", "fail", \{ why: [^\n]*, code: \(act && act\.code\) \|\| undefined, key: \(act && act\.key\) \|\| undefined \}\);/);
});

test("the wall admits exactly the keys a publish writes outside the site's prefixes, and nothing wider", async () => {
  const { allowedJobKey } = await import("../builder/job-gateway.mjs");
  const { siteMetaKey } = await import("../site-meta.mjs");
  const { P_ORPHANS } = await import("../site-sweep.mjs");
  const { POINTER_KEY } = await import("../site-builds.mjs");
  const { CONFIG_KEY } = await import("../site-config.mjs");
  const id = "0123456789abcdef0123456789abcdef";
  // DERIVED FROM THE BUILDERS: every single-object key the Worker writes for a
  // site is admitted for that site and refused for another.
  for (const build of [siteMetaKey, P_ORPHANS, POINTER_KEY, CONFIG_KEY]) {
    assert.equal(allowedJobKey("cafe", id, build("cafe")), true, "refused for its own site: " + build("cafe"));
    assert.equal(allowedJobKey("cafe", id, build("other")), false, "admitted for another site: " + build("other"));
    assert.equal(allowedJobKey("cafe", id, build("cafe") + ".bak"), false, "admitted with a suffix: " + build("cafe") + ".bak");
  }
  // And the wall's own spelling of the two this stage added matches the builders.
  const gw = fs.readFileSync(new URL("../builder/job-gateway.mjs", import.meta.url), "utf8");
  assert.match(gw, /if \(k === "sitemeta\/" \+ slug \+ "\.json"\) return true;/);
  assert.match(gw, /if \(k === "orphans\/" \+ slug \+ "\.json"\) return true;/);
  assert.equal(siteMetaKey("x"), "sitemeta/x.json");
  assert.equal(P_ORPHANS("x"), "orphans/x.json");
});
