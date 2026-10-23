// SLASH COMMANDS IN THE SITE BUILDER'S CHAT (2026-10-23, the owner: "like
// Claude's / menu"). The block between its two landmarks in public/chat.js is
// run here against stubs of what it calls; the wiring around it (the composer,
// the thread's card, the panel's button) is read from the source, landmark to
// landmark. Nothing here calls a model or the network.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SRC = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const BEGIN = "// ── SLASH COMMANDS BEGIN";
const END = "// ── SLASH COMMANDS END ──";

function block() {
  const a = SRC.indexOf(BEGIN), b = SRC.indexOf(END);
  assert.ok(a >= 0 && b > a, "the slash-command block's landmarks are in chat.js");
  return SRC.slice(a, b);
}
function fnBody(name) {
  const a = SRC.indexOf("function " + name + "(");
  assert.ok(a >= 0, name + " exists");
  const b = SRC.indexOf("\n}\n", a);
  assert.ok(b > a, name + " ends");
  return SRC.slice(a, b);
}

function load(over = {}) {
  const box = { hidden: true, innerHTML: "" };
  const calls = { fetch: [], deep: [], saves: 0, renders: 0, sent: [] };
  const site = { id: "s1", slug: "fold-lane-bakery", msgs: [] };
  const draft = { t: "" };
  const ctx = {
    document: { getElementById: (id) => (id === "stSlash" ? box : null) },
    esc: (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]),
    siteBusy: false, siteOpenId: "s1", buildPicker: "grok", secEstimate: {},
    siteDraft: () => draft, siteById: (id) => (id === site.id ? site : null),
    sitesSave: () => { calls.saves++; }, renderSites: () => { calls.renders++; },
    apiFetch: async (url, opts) => {
      calls.fetch.push({ url, method: (opts && opts.method) || "GET" });
      return { ok: true, json: async () => ({ ok: true, estimate: { standard: { credits: 4, areas: ["Sign-in", "Data rules"] }, thorough: { credits: 9 } }, say: "[stub model reply] I'll check Sign-in and Data rules; about 4 credits.", working: "[stub] Checking sign-in and data rules…" }) };
    },
    siteSend: (t, leave) => { calls.sent.push(t); calls.leave = leave; },
    siteSecurityDeep: async (s, opts) => { calls.deep.push(s); calls.deepOpts = opts; return { findings: [], cost: 4, say: "[stub model report] No problems found; it used 4 credits." }; },
    siteSecuritySay: (rep) => "SAID:" + (rep ? rep.cost : "none"),
    crypto: { randomUUID: () => "aaaa-bbbb" }, setTimeout: (f) => setTimeout(f, 0),
    ...over,
  };
  vm.createContext(ctx);
  const api = vm.runInContext(block() + "\n;({ SLASH_COMMANDS, slashQuery, slashMatches, slashCommandOf, slashPaint, slashKey, slashSend, siteSecurityOffer, siteSentinelHTML, siteSentinelGo, siteSentinelNo })", ctx);
  return { api, box, calls, site, draft, ctx };
}
const key = (k, extra = {}) => { const e = { key: k, shiftKey: false, prevented: false, ...extra }; e.preventDefault = () => { e.prevented = true; }; return e; };
const tick = () => new Promise((r) => setTimeout(r, 0));

test("the registry is one array of { name, desc, run }, and /sentinel is in it", () => {
  const { api } = load();
  assert.ok(Array.isArray(api.SLASH_COMMANDS) && api.SLASH_COMMANDS.length >= 1);
  for (const c of api.SLASH_COMMANDS) {
    assert.match(c.name, /^[a-z0-9-]+$/);
    assert.ok(typeof c.desc === "string" && c.desc.length > 5 && !c.desc.includes("\n"), "one line about it");
    assert.equal(typeof c.run, "function");
  }
  assert.ok(api.SLASH_COMMANDS.some((c) => c.name === "sentinel"));
});

test("the menu opens on '/' only at the very start of the message", () => {
  const { api, box } = load();
  assert.equal(api.slashQuery("/"), "");
  assert.equal(api.slashQuery("/Sen"), "sen");
  for (const t of ["", "hello", "hi /sen", " /sen", "/sentinel now", "//"]) assert.equal(api.slashQuery(t), null, JSON.stringify(t));
  assert.equal(api.slashQuery(["/"]), null, "a non-string is refused, never coerced");
  const ta = { value: "/" };
  assert.equal(api.slashPaint(ta), true);
  assert.equal(box.hidden, false);
  assert.match(box.innerHTML, /data-slash="sentinel"/);
  assert.match(box.innerHTML, /<span>Ask for a deep security check/);
  ta.value = "make the header blue /sentinel";
  assert.equal(api.slashPaint(ta), false);
  assert.equal(box.hidden, true, "a '/' later in the message opens nothing");
});

test("typing filters the menu, and a word that is no command says so", () => {
  const { api, box } = load();
  const ta = { value: "/sen" };
  api.slashPaint(ta);
  assert.match(box.innerHTML, /\/sentinel/);
  assert.equal(JSON.stringify(api.slashMatches("sen").map((c) => c.name)), JSON.stringify(["sentinel"]));
  ta.value = "/zzz";
  api.slashPaint(ta);
  assert.equal(box.hidden, false);
  assert.doesNotMatch(box.innerHTML, /data-slash=/);
  assert.match(box.innerHTML, /No command matches \/zzz/);
});

test("arrows move, Enter picks the highlighted command, Esc closes until the text changes", async () => {
  const { api, box, site, calls, ctx } = load();
  // a second command, to prove the arrows move (the registry is open for more)
  let other = 0;
  api.SLASH_COMMANDS.push({ name: "seo", desc: "test entry", run: () => { other++; } });
  const ta = { value: "/se" };
  api.slashPaint(ta);
  assert.match(box.innerHTML, /class="st-slash-it on"[^>]*data-slash="sentinel"/);
  const down = key("ArrowDown");
  assert.equal(api.slashKey(down, ta, site), true);
  assert.ok(down.prevented);
  assert.match(box.innerHTML, /class="st-slash-it on"[^>]*data-slash="seo"/);
  api.slashKey(key("ArrowDown"), ta, site);
  assert.match(box.innerHTML, /class="st-slash-it on"[^>]*data-slash="sentinel"/, "it wraps");
  api.slashKey(key("ArrowUp"), ta, site);
  const enter = key("Enter");
  assert.equal(api.slashKey(enter, ta, site), true);
  assert.equal(other, 1, "Enter ran the highlighted command");
  assert.equal(ta.value, "", "the box is emptied");
  assert.equal(box.hidden, true);
  // Esc
  ta.value = "/sen";
  api.slashPaint(ta);
  assert.equal(api.slashKey(key("Escape"), ta, site), true);
  assert.equal(box.hidden, true);
  assert.equal(api.slashPaint(ta), false, "stays shut for the same text");
  ta.value = "/sent";
  assert.equal(api.slashPaint(ta), true, "reopens when the text changes");
  // closed menu: keys are not the menu's
  ta.value = "hello"; api.slashPaint(ta);
  assert.equal(api.slashKey(key("Enter"), ta, site), false);
  await tick();
  void calls; void ctx;
});

test("Enter on no match sends nothing; an unknown command sent is held, never an edit", () => {
  const { api, box, site, calls } = load();
  const ta = { value: "/zzz" };
  api.slashPaint(ta);
  assert.equal(api.slashKey(key("Enter"), ta, site), true, "Enter is the menu's, so the composer does not send");
  assert.equal(ta.value, "/zzz");
  box.hidden = true;
  assert.equal(api.slashSend("/zzz please", ta, site), true, "the Send button stops here");
  assert.equal(box.hidden, false);
  assert.match(box.innerHTML, /No command matches \/zzz/);
  assert.equal(site.msgs.length, 0);
  assert.equal(calls.fetch.length, 0);
  assert.equal(api.slashSend("make it blue", ta, site), false, "an ordinary message goes on");
  assert.equal(api.slashSend("/about page needs a photo", ta, site), true, "a /word is a command, unknown ones are held");
});

test("the composer asks slashSend before siteSend, and the keys go to the menu first", () => {
  const w = fnBody("wireSiteComposer");
  const s = w.indexOf("slashSend(t, ta, site)"), send = w.indexOf("siteSend(t)");
  assert.ok(s > 0 && send > s, "slashSend comes before siteSend");
  assert.match(w.slice(s - 30, send), /if \(t && !siteBusy && slashSend\(t, ta, site\)\) return;/);
  assert.match(w, /ta\.onkeydown = \(e\) => \{ if \(slashKey\(e, ta, site\)\) return;/);
  assert.match(w, /ta\.oninput = \(\) => \{ draft\.t = ta\.value; slashPaint\(ta\); \};/);
  assert.match(w, /slashMenu\.onmousedown/);
  assert.match(SRC, /'<div class="st-slash" id="stSlash" role="listbox"[^']*hidden><\/div>' \+\n\s+'<textarea id="stRevise"/, "the menu sits above the site composer's box");
});

// ── /sentinel IS A MESSAGE TO THE MODEL (owner, 2026-10-23) ────────────────
// "like the user telling the model to start a security check": the command is
// sent as an ordinary message through the router, the model's reply carries
// what it will check and the price, and the scan waits for a confirmation.
const finishInto = (site) => (t) => site.msgs.push({ r: "a", t });

test("/sentinel sends its words as an ordinary message, through the normal send, and spends nothing itself", () => {
  const { api, calls, site, draft } = load();
  draft.t = "/sentinel";
  const ta = { value: "/sentinel" };
  assert.equal(api.slashSend("/sentinel", ta, site), true);
  assert.equal(calls.sent.length, 1, "not sent as one message");
  assert.match(calls.sent[0], /^\/sentinel — .*security/i, "the thread shows the command with what it means");
  assert.equal(calls.leave, true, "the platform's words are sent without taking the composer's draft");
  assert.equal(ta.value, "", "the box is cleared");
  assert.equal(calls.fetch.length, 0, "no price read or scan from the slash branch itself");
  assert.equal(calls.deep.length, 0);
  // AND THE FIXED PRICE BOX IS GONE FROM THE BLOCK.
  assert.doesNotMatch(block(), /Scan · about/);
});

test("the router's security answer gets the model's own reply with the price, and the scan waits for the press", async () => {
  const { api, site, calls } = load();
  await api.siteSecurityOffer(site, "/sentinel — please run a deep security check of my site", "s1", finishInto(site));
  assert.equal(calls.fetch.length, 1);
  assert.match(calls.fetch[0].url, /^\/api\/site\/fold-lane-bakery\/security\?estimate=1&picker=grok&say=1&message=/, "the free, sized price read asks for the model's words");
  assert.equal(calls.deep.length, 0, "no scan before the press");
  const card = site.msgs[site.msgs.length - 1];
  assert.equal(card.t, "[stub model reply] I'll check Sign-in and Data rules; about 4 credits.", "the model's reply is what is said");
  assert.equal(card.sentinel.state, "offer");
  const html = api.siteSentinelHTML(card);
  assert.match(html, /data-sentinel-go="aaaabbbb">Yes, run the check</);
  assert.doesNotMatch(html, /credit/, "the price is in the model's words, not a fixed box");
  api.siteSentinelNo("s1", card.sentinel.key);
  assert.equal(calls.deep.length, 0);
  assert.equal(api.siteSentinelHTML(card), "", "the card is gone once answered");
  await api.siteSentinelGo("s1", card.sentinel.key);
  assert.equal(calls.deep.length, 0, "a declined offer cannot be pressed later");
});

test("confirming runs the panel's own handler once, with the model's working line and report", async () => {
  const { api, site, calls } = load();
  await api.siteSecurityOffer(site, "check my site", "s1", finishInto(site));
  const card = site.msgs[site.msgs.length - 1];
  const go = api.siteSentinelGo("s1", card.sentinel.key);
  const live = site.msgs[site.msgs.length - 1];
  assert.equal(live.prog[0].text, "[stub] Checking sign-in and data rules…", "the line while it works is the model's");
  await Promise.all([go, api.siteSentinelGo("s1", card.sentinel.key)]);
  assert.equal(calls.deep.length, 1, "two quick presses scan once");
  assert.deepEqual([calls.deepOpts.say, calls.deepOpts.message, typeof calls.deepOpts.key], [true, "check my site", "string"]);
  assert.equal(site.msgs[site.msgs.length - 1].t, "[stub model report] No problems found; it used 4 credits.");
  assert.ok(!calls.fetch.some((f) => f.method === "POST"), "the stubbed handler is the only spender");
});

test("a failed price read offers nothing to press", async () => {
  const { api, site, calls } = load({ apiFetch: async () => ({ ok: false, json: async () => ({ ok: false }) }) });
  await api.siteSecurityOffer(site, "check my site", "s1", finishInto(site));
  const last = site.msgs[site.msgs.length - 1];
  assert.equal(last.sentinel, undefined);
  assert.equal(api.siteSentinelHTML(last), "");
  assert.equal(calls.deep.length, 0);
});

test("drift guard: the router's security answer goes through the offer, never straight to the paid scan", () => {
  assert.match(fnBody("loadSiteSecurity"), /deepBtn\.onclick = \(\) => siteSecurityDeep\(site\);/, "the panel's button");
  assert.match(SRC, /if \(d\.intent === 'security' && site\.slug\) return siteSecurityOffer\(site, t, origin, finish\);/, "the router's answer");
  assert.doesNotMatch(SRC, /d\.intent === 'security'[^\n]*siteSecurityDeep/, "a plain-words request starts the paid scan with no price");
  const go = fnBody("siteSentinelGo");
  assert.match(go, /await siteSecurityDeep\(s, \{ say: true/);
  assert.doesNotMatch(block(), /\/security'\s*,\s*\{\s*method: 'POST'/, "the block never posts a scan of its own");
  assert.ok(fnBody("siteSecurityOffer").includes("'/security?estimate=1&picker=' + encodeURIComponent(buildPicker)"));
  assert.match(SRC, /siteModel3dHTML\(m, site\) \+ siteSentinelHTML\(m\)/);
  assert.match(SRC, /closest\('\[data-sentinel-go\]'\);\n\s+if \(snGo && thread\.contains\(snGo\)\) \{ siteSentinelGo\(site\.id, snGo\.getAttribute\('data-sentinel-go'\)\); return; \}/);
});
