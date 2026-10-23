// DECIDE-ALL (2026-10-23), the owner's rule: no hardcoded customer-facing
// message. Each sentence the decided branches added is carried as structured
// facts and told by the reply writer; the step's own `msg` is only the
// fallback shown when no reply could be written. These cases hold both halves:
// the facts reach the writer (and the `msg` does not stand in for them), and
// the server carries the structure the facts are read from.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { editReplyFacts, addonReplyFacts, routeReplyFacts, buildReplyFacts, refusalFacts, langFacts, languageNamed, DECIDED_REFUSALS } from "../builder/site-reply.mjs";
import { buildFacts } from "../builder/build-answer.mjs";
import { filingFloorRefusal } from "../builder/publish-pages.mjs";

const SENTINEL = "SENTINEL-CODE-SENTENCE";
const texts = (r) => r.facts.map((f) => f.text).join("\n");
const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const NAV = readFileSync(new URL("../builder/site-nav.mjs", import.meta.url), "utf8");
const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

test("a language reaches the writer by name, never as a bare tag", () => {
  assert.equal(languageNamed("es"), "Spanish (es)");
  assert.match(languageNamed("fr"), /^French/);
  assert.equal(languageNamed(""), "");
});

test("every decided refusal is told from its facts, and the step's own sentence does not stand in", () => {
  const cases = {
    "out-of-credits": { floor: 5 },
    "menu-page-unknown": { pages: ["/status"] },
    "menu-no-menu": { pages: ["/visit"] },
    "qr-forget-blocked": { host: "old.gofarther.app", codes: ["Table card"] },
    "site-offline": {},
    "name-too-long": { chars: 50, max: 43, suggested: "short-name" },
    "media-unmoved": { files: [{ name: "Jingle.wav", why: "it was no longer kept" }], moved: 0, again: "attach" },
  };
  assert.deepEqual(Object.keys(cases).sort(), [...DECIDED_REFUSALS].sort(), "a decided refusal has no case here");
  for (const [code, extra] of Object.entries(cases)) {
    const r = editReplyFacts({ ok: false, error: "x", msg: SENTINEL, refusal: { code, ...extra } });
    assert.equal(r.skip, null, code);
    assert.ok(r.facts.length > 0, code + ": no facts reached the writer");
    assert.ok(!texts(r).includes(SENTINEL), code + ": the step's sentence was quoted in place of the facts");
  }
  const qr = texts(editReplyFacts({ ok: false, error: "x", refusal: { code: "qr-forget-blocked", host: "old.gofarther.app", codes: ["Table card", "Flyer"] } }));
  assert.match(qr, /Table card/); assert.match(qr, /Flyer/); assert.match(qr, /old\.gofarther\.app/);
  assert.match(texts(editReplyFacts({ ok: false, error: "x", refusal: { code: "menu-page-unknown", pages: ["/status"] } })), /\/status/);
  // AN UNKNOWN CODE IS NOT A FACT: the old path (the step's own reason) is kept.
  assert.match(texts(editReplyFacts({ ok: false, error: "x", msg: SENTINEL, refusal: { code: "nope" } })), new RegExp(SENTINEL));
});

test("the out-of-credits refusal is told on the routing, edit and add-on answers alike", () => {
  const ref = { ok: false, error: "not enough credits", need: "credits", cost: 0, floor: 5, refusal: { code: "out-of-credits", floor: 5 }, msg: SENTINEL };
  for (const r of [routeReplyFacts(ref), editReplyFacts(ref), addonReplyFacts(ref)]) {
    assert.equal(r.skip, null);
    assert.match(texts(r), /below the 5 credits/);
    assert.ok(!texts(r).includes(SENTINEL));
  }
});

test("the floor's refusal carries its code, not only a sentence", async () => {
  const r = await filingFloorRefusal({ free: false, readBalance: async () => 2, log: () => {} });
  assert.deepEqual(r.refusal, { code: "out-of-credits", floor: 5 });
});

test("translations: stuck, behind, the owner's own wording and wording whose source changed are facts, by language name", () => {
  const F = { out: [], add(kind, text) { this.out.push({ kind, text }); } };
  langFacts(F, {
    langs: [{ tag: "es", ok: false, why: "stuck" }, { tag: "fr", ok: true, behind: 7 }],
    langOverride: { tag: "es", changed: [{ from: "Fresh bread", said: "Pan recien hecho" }] },
    langStale: { de: ["Old words"] },
  });
  const t = F.out.map((f) => f.text).join("\n");
  assert.match(t, /Spanish \(es\) pages were not translated/);
  assert.match(t, /7 phrases on the French \(fr\) pages/);
  assert.match(t, /Pan recien hecho/);
  assert.match(t, /German \(de\) wording for “Old words”/);
  // AND THEY REACH THE WRITER ON AN EDIT'S ANSWER.
  const r = editReplyFacts({ ok: true, layer: "text", applied: 1, changed: ["Pan recien hecho"], langOverride: { tag: "es", changed: [{ from: "Fresh bread", said: "Pan recien hecho" }] }, langs: [{ tag: "fr", ok: false, why: "call" }] });
  assert.match(texts(r), /Spanish \(es\)/);
  assert.match(texts(r), /French \(fr\) pages could not be translated/);
});

test("a build: Stop, a name too long and the attached logo are facts for the writer", () => {
  assert.match(texts(buildReplyFacts(buildFacts({ failure: { kind: "stopped", cost: 0 } }))), /pressed Stop/);
  const long = texts(buildReplyFacts(buildFacts({ refusal: { code: "name-too-long", chars: 50, max: 43, suggested: "short-name" } })));
  assert.match(long, /43 characters/); assert.match(long, /short-name/);
  assert.match(texts(buildReplyFacts(buildFacts({ ownLogo: { wordmark: { form: "image", url: "/u/x" }, name: "logo.png" } }))), /logo.png” is in the site's header/);
  assert.match(texts(buildReplyFacts(buildFacts({ ownLogo: { missing: { name: "logo.pdf", reason: "that attachment is not an image" } } }))), /could not be put in the header \(that attachment is not an image\)/);
});

test("THE WIRING: the server carries each structure to the writer", () => {
  // The menu step's two scoped refusals carry codes, and the route passes them on.
  assert.match(NAV, /refusal: \{ code: "menu-page-unknown", pages: scope\.unknown\.slice\(\) \}/);
  assert.match(NAV, /refusal: \{ code: "menu-no-menu", pages: scope\.pages\.slice\(\) \}/);
  assert.match(W, /refusal: nOut\.refusal \|\| undefined/);
  assert.match(W, /refusal: \{ code: "qr-forget-blocked", host: fHost \|\| drop, codes: fCodes\.map\(\(c\) => c\.name\) \}/);
  assert.equal((W.match(/refusal: \{ code: "site-offline" \}, error: OFFLINE_PUBLISH_REFUSAL/g) || []).length, 3, "a Publish refusal for an offline site carries no code");
  // The floor's refusals on the edit and add-on routes go through the writer.
  assert.match(W, /if \(eFloor\) return withModelReply\(env, Response\.json\(eFloor, \{ status: 402 \}\), "edit", eReplyOut\)/);
  assert.match(W, /if \(aFloor\) return withModelReply\(env, Response\.json\(aFloor, \{ status: 402 \}\), "addon", aReplyOut\)/);
  // The build's Stop and name refusal are narrated; the logo is among the build's facts.
  const stop = W.indexOf("const stoppedAnswer = async (stage) => {");
  assert.ok(stop > 0);
  assert.match(W.slice(stop, stop + 1600), /narrateBuild\(env, \{[\s\S]*buildFacts: buildFacts\(\{ failure: \{ kind: "stopped"/);
  assert.match(W, /buildFacts: buildFacts\(\{ refusal: tooLong \}\)/);
  assert.match(W, /checks: buildChecks\(pages\),\n\s*\/\/[^\n]*\n\s*ownLogo,/);
  assert.match(W, /langStale: Object\.keys\(langStale\)\.length \? langStale : undefined/);
  // The page shows the written reply first on the routing route's credits refusal.
  assert.match(CHAT, /d\.need === 'credits' && \(routeSaid \|\|[\s\S]{0,300}finish\(routeSaid \|\| d\.msg\)/);
});

test("refusalFacts refuses what is not a decided refusal", () => {
  const F = { out: [], add(k, t) { this.out.push(t); } };
  assert.equal(refusalFacts(F, null), false);
  assert.equal(refusalFacts(F, { code: "other" }), false);
  assert.equal(F.out.length, 0);
});
