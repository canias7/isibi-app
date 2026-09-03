// PROVING A PUBLISHED SITE BELONGS TO THE BUSINESS THAT OWNS IT.
//
// Search Console, Bing, Pinterest and Facebook all want the same thing: a
// `<meta>` tag with a token they generated. Every tag in a published head is
// composed by `__root.tsx` out of a sidecar the platform writes, and an owner
// could not add a character to either — so a business could not get itself
// indexed, could not see what it ranked for, and could not run an ad against
// its own domain.
//
// THE TESTS ARE IN TWO HALVES and the second is the one that matters here. The
// module's decisions are easy; this repo's recorded failure is a feature that is
// correct at every layer and reaches nothing, which has happened at least twelve
// times. So the wiring — sidecar, both publish paths, the route's three lists,
// the template's render — is asserted as its own chain.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  VERIFIERS, VERIFIER_NAMES, MIN_TOKEN, MAX_TOKEN,
  isVerificationToken, readPastedTag, mergeVerification, verificationPairs, verificationNote,
} from "../builder/site-verify.mjs";

const ROOT = new URL("..", import.meta.url);
const read = (p) => readFileSync(fileURLToPath(new URL(p, ROOT)), "utf8");
const GOOG = "g".repeat(43);

// ───────────────────────────────────────────────────────────── what may be said

test("the providers are a fixed table and nothing else can be named", () => {
  assert.ok(VERIFIER_NAMES.length >= 4, "the table collapsed");
  for (const n of VERIFIER_NAMES) {
    const v = VERIFIERS[n];
    assert.match(v.meta, /^[a-z][a-z0-9:._-]*$/i, n + " has a meta name that is not a bare attribute name");
    assert.ok(v.label && v.hint, n + " has nothing to show an owner");
  }
  // The four the corpus's own customers would reach for.
  for (const n of ["google", "bing", "pinterest", "facebook"]) assert.ok(VERIFIERS[n], n + " is missing");
  assert.equal(VERIFIERS.google.meta, "google-site-verification");
  assert.equal(VERIFIERS.bing.meta, "msvalidate.01");
});

test("a token is an opaque string of a known shape, and nothing else", () => {
  // THIS IS WHAT MAKES THE EMITTED TAG SAFE BY CONSTRUCTION. The name comes from
  // the table and the token from here, so nothing arbitrary reaches the markup
  // and there is no escaping question to get wrong — the rule `site-tokens.mjs`
  // already lives under for colours in a stylesheet.
  assert.equal(isVerificationToken(GOOG), true);
  assert.equal(isVerificationToken("aBc-1_2.3="), true, "base64url with padding is what these providers issue");
  for (const bad of [
    'x" onload="alert(1)', "a<b", "has space", "tab\there", "line\nbreak",
    "'", "short", "", null, undefined, 7, ["abcdefghij"], {},
  ]) assert.equal(isVerificationToken(bad), false, JSON.stringify(bad) + " was accepted");
  assert.equal(isVerificationToken("a".repeat(MIN_TOKEN - 1)), false, "the floor does not bind");
  assert.equal(isVerificationToken("a".repeat(MAX_TOKEN + 1)), false, "the ceiling does not bind");
  assert.equal(isVerificationToken("a".repeat(MAX_TOKEN)), true);
});

test("pasting the whole meta tag works, because that is what people do", () => {
  // The provider's page gives a copy button for the entire line. Refusing it and
  // saying "just the token please" is a support question created on purpose.
  assert.equal(readPastedTag('<meta name="google-site-verification" content="' + GOOG + '" />'), GOOG);
  assert.equal(readPastedTag("<meta name='msvalidate.01' content='ABCD1234'>"), "ABCD1234");
  // A bare token passes straight through — this is a convenience on the way in,
  // not a parser standing between every value and the check below it.
  assert.equal(readPastedTag(GOOG), GOOG);
  assert.equal(readPastedTag("  spaced-out-token  "), "spaced-out-token");
  // Something that looks like a tag and has no content attribute falls through
  // to the token check, which refuses it with a message rather than storing junk.
  assert.equal(isVerificationToken(readPastedTag("<meta name='x'>")), false);
});

test("absent means unchanged, empty means remove, unknown is refused", () => {
  const cur = { google: GOOG, bing: "BING1234" };
  // Silence about a provider leaves it exactly as it was — the rule every edit
  // path in this codebase follows.
  assert.deepEqual(mergeVerification(cur, { pinterest: "PIN12345" }).verify,
    { google: GOOG, bing: "BING1234", pinterest: "PIN12345" });
  // The empty string is the removal verb, and it is the only way an owner has to
  // take a verification off without a second control.
  assert.deepEqual(mergeVerification(cur, { bing: "" }).verify, { google: GOOG });
  // A provider nothing emits is a setting that reads as applied and does nothing.
  const un = mergeVerification(cur, { wix: "whatever12" });
  assert.deepEqual(un.verify, cur);
  assert.deepEqual(un.refused, [{ name: "wix", reason: "unknown" }]);
  // A PROTOTYPE KEY IS NOT A PROVIDER. `VERIFIERS["constructor"]` is truthy —
  // it is `Object.prototype.constructor` — so a truthiness check stores a junk
  // key nothing will ever emit and reports it as accepted. That exact bug has
  // shipped in this repo twice: the Stripe plan lookup, and the zip-member map.
  for (const key of ["constructor", "toString", "hasOwnProperty"]) {
    const r = mergeVerification(cur, { [key]: "abcdefghij" });
    assert.deepEqual(r.verify, cur, key + " was stored as a provider");
    assert.deepEqual(r.refused, [{ name: key, reason: "unknown" }], key + " was accepted");
  }
  // A bad shape is REPORTED rather than dropped: an owner whose verification
  // silently never happens has nothing to act on.
  const bad = mergeVerification(cur, { google: "not a token" });
  assert.deepEqual(bad.refused, [{ name: "google", reason: "shape" }]);
  assert.equal(bad.verify.google, GOOG, "a refused value must not destroy the stored one");
  // A stored value that is somehow no longer valid is dropped on the way out,
  // so a hand-edited row cannot resurrect a bad token.
  assert.deepEqual(mergeVerification({ google: "<script>" }, {}).verify, {});
});

test("the pairs are resolved names in a fixed order", () => {
  // FIXED ORDER, so a site whose settings have not changed produces a
  // byte-identical head. Key order on a JSON round trip is not something to
  // depend on, and a head that reshuffles every publish is an unreadable diff.
  const a = verificationPairs({ bing: "BING1234", google: GOOG });
  const b = verificationPairs({ google: GOOG, bing: "BING1234" });
  assert.deepEqual(a, b);
  assert.deepEqual(a, [
    { name: "google-site-verification", content: GOOG },
    { name: "msvalidate.01", content: "BING1234" },
  ]);
  // Nothing invalid ever becomes a pair, whatever is in the stored object.
  assert.deepEqual(verificationPairs({ google: 'x" onload="y' }), []);
  assert.deepEqual(verificationPairs({ nope: GOOG }), []);
  assert.deepEqual(verificationPairs(null), []);
  assert.deepEqual(verificationPairs("google"), []);
});

test("the note names the provider and says which of the two went wrong", () => {
  // "That didn't work" over a 43-character opaque string leaves somebody
  // re-pasting the same thing. The two reasons need different actions: a shape
  // refusal means they copied the wrong part of the page.
  const shape = verificationNote(mergeVerification({}, { google: "no good" }));
  assert.match(shape, /Google Search Console/);
  assert.match(shape, /content=/, "it does not say which part to copy");
  const un = verificationNote(mergeVerification({}, { wix: "abcdefgh" }));
  assert.match(un, /wix/);
  assert.match(verificationNote({ verify: { google: GOOG } }), /Verifying with Google Search Console/);
  assert.equal(verificationNote({ verify: {}, refused: [] }), "", "a clean save says nothing rather than something empty");
  assert.equal(verificationNote(), "");
});

// ────────────────────────────────────────── and the chain that reaches a page

test("the sidecar carries the resolved pairs", () => {
  // The head is no longer patched into a built shell — under Start the document
  // is `__root.tsx` rendered per request, reading this file. So the sidecar IS
  // the wire, and a field missing here is a feature that works everywhere and
  // reaches nothing.
  const w = read("worker.js");
  const i = w.indexOf("const sidecar = {");
  assert.ok(i > 0, "the sidecar moved — re-anchor this check");
  const win = w.slice(i, w.indexOf("};", i));
  assert.match(win, /verify: verificationPairs\(/, "the sidecar does not carry the verification");
});

test("BOTH publish paths carry the stored verification", () => {
  // The sidecar is rewritten WHOLE on every publish, so a path that does not
  // carry it sends none — and an owner's Search Console tag would vanish the
  // next time they fixed a typo. Derived over every call rather than the two
  // that exist today, because a hand-written list is what leaves the third bare.
  const w = read("worker.js");
  const calls = [...w.matchAll(/writeSiteDistToR2\(env, [a-z]+, [a-zA-Z.]+, \{/g)];
  assert.ok(calls.length >= 2, "only " + calls.length + " publish calls found — the scan stopped matching");
  for (const m of calls) {
    const win = w.slice(m.index, w.indexOf("}, ", m.index));
    assert.match(win, /\bverify\b/, "a publish path at index " + m.index + " drops the verification");
  }
});

test("every publish-payload read of the config loads it, and BINDS it", () => {
  // THE CALL SITE IS NOT ENOUGH, and a mutant proved it: `verify` still appears
  // in `writeSiteDistToR2(…, { verify })` when the variable it names was never
  // filled, so the guard above passes on a spine that publishes `undefined`.
  //
  // THE LOADING HALF IS NOW A PROPERTY. Until 2026-08-24 each payload path wrote
  // its own `SELECT … WHERE k IN (…)` and could legitimately ask for five of the
  // six keys, so this scanned the queries. The config is one R2 object now and
  // `loadConfig` answers with every field or refuses — there is no key list left
  // to leave the verification out of.
  const w = read("worker.js");
  assert.match(read("site-config.mjs"), /CONFIG_FIELDS = \[[^\]]*"verify"/,
    "the verification is no longer part of a site's config, so a publish path can miss it again");
  // THE BINDING HALF STILL HAS TO BE ASSERTED, because loading a config and not
  // destructuring it is the same as not loading it and looks identical from the
  // call. Both payload paths, by name — the spine binds all six at once, the
  // build path assigns each into its own `prior*`.
  assert.match(w, /\(\{ look, css, logo, icon, verify, langStrings \} = cfg\.config\)/,
    "the spine loads the config and does not bind the verification out of it");
  assert.match(w, /priorVerify = cfg\.config\.verify;/,
    "the build path loads the config and does not bind the verification out of it");
});

test("the route is in all THREE lists, which is where the dm2 bug lived", () => {
  // A matcher, the dispatch condition and `ownerSlug`. `/domains` was in one of
  // the three and was unreachable end to end for weeks — indistinguishable from
  // working, because `assertOwner` answers 404 for a slug that is not yours.
  const w = read("worker.js");
  assert.match(w, /const sv = url\.pathname\.match\(\/\^\\\/api\\\/site/, "no matcher");
  // RE-ANCHORED 2026-09-03: both matches pinned `om || mm ||` — the first TWO
  // names of the list — and went red the day the CSV-import matcher (`im`)
  // was put between them. The condition and the slug list are the ones whose
  // expression opens with `om ||`; the property is that `sv` is in each.
  const cond = w.match(/if \(om \|\|[^)]*\) \{/);
  assert.ok(cond, "the dispatch condition moved");
  assert.match(cond[0], /\|\| sv\b/, "the route is matched and never dispatched");
  const own = w.match(/const ownerSlug = \(om \|\|[^)]*\)/);
  assert.ok(own, "ownerSlug moved");
  assert.match(own[0], /\|\| sv\b/, "ownerSlug would read the slug of whichever route matched first");
  assert.match(w, /\} else if \(sv\) \{/, "there is no handler");
});

test("the route is owner-gated, never model-driven, and costs nothing", () => {
  const w = read("worker.js");
  const i = w.indexOf("} else if (sv) {");
  const win = w.slice(i, w.indexOf("} else if (nt) {", i));
  assert.match(win, /assertOwner\(ownerDeps, vslug, ou\.id\)/, "the route is not owner-gated");
  assert.match(win, /mergeVerification\(stored, vbody\.verify\)/, "the body is trusted rather than merged");
  // NO MODEL CALL ANYWHERE ON THIS PATH. The token is a 43-character opaque
  // string nobody types, so extracting it from prose is a call that fails
  // silently when it gets it wrong — and this is a set-once action on the same
  // shelf as Secrets and Domains.
  for (const paid of ["anthropicMessages", "runTweak", "generateSitePages", "eCharge", "useCredits"]) {
    assert.ok(!win.includes(paid), "the verify route reaches " + paid);
  }
  // CANNOT TELL IS NOT NOT-SET. An empty answer would show a blank form and
  // invite an owner to re-paste a token that is already stored — and the POST
  // that followed would write over it.
  assert.match(win, /if \(!vconn\) return Response\.json\(\{ ok: false[\s\S]{0,120}503 \}\)/,
    "an unreachable database reads as no verification");
});

test("a save takes effect without a republish, and says which happened", () => {
  const w = read("worker.js");
  const i = w.indexOf("} else if (sv) {");
  const win = w.slice(i, w.indexOf("} else if (nt) {", i));
  // The site's own Worker reads its head out of the sidecar, so patching that
  // one key IS the deployment. The alternative is a 40-second container run to
  // change a string, while the owner has the provider's Verify button open.
  // ANCHORED AT THE START OF THE STATEMENT. A bare `siteMetaKey(vslug)` match is
  // satisfied by a dead `if (0) await …get(siteMetaKey(vslug))` — measured by a
  // mutant that survived. Reading what is already there is the whole point:
  // writing a fresh object would wipe the description, the share image and the
  // route manifest out of the head.
  assert.match(win, /const cur = await env\.SITES_BUCKET\.get\(siteMetaKey\(vslug\)\);/,
    "the sidecar is written without reading it — every other head field is wiped");
  assert.match(win, /const side = cur \? JSON\.parse\(await cur\.text\(\)\) : \{\};/,
    "the existing sidecar is replaced rather than patched");
  assert.match(win, /siteMetaKey\(vslug\)[\s\S]{0,400}\.put\(/, "nothing is written back");
  // BEST-EFFORT AND THE STORED VALUE IS ALREADY SAFE: the write happens first,
  // so a sidecar failure is a delay rather than a lost token.
  assert.ok(win.indexOf("'site_verify'") < win.indexOf("siteMetaKey(vslug)"),
    "the sidecar is patched before the value is stored — a failure there loses the token");
  assert.match(win, /\blive\b/, "the answer cannot tell 'on your site now' from 'with your next publish'");
});

test("the template renders the pairs, and checks their shape anyway", () => {
  // BOTH ENDS. The platform resolving them is what stops a site naming its own
  // tag; the template checking is because this value comes off an R2 read and a
  // bad row would otherwise render `name="undefined"` on every page.
  const root = read("builder/lovable/template/src/routes/__root.tsx");
  assert.match(root, /m\?\.verify/, "the document never reads the verification");
  assert.match(root, /typeof v\.name === "string"/, "a malformed row is spread straight into a meta tag");
  assert.match(root, /\.slice\(0, \d+\)/, "the list is unbounded");
  const rt = read("builder/lovable/template/src/site-runtime.ts");
  assert.match(rt, /verify\?: Array<\{ name: string; content: string \}>/, "SiteMeta does not declare it");
});

test("the panel asks the SERVER which providers exist", () => {
  // A hand-written list in the client is a second opinion about which providers
  // exist, and the day they disagree the panel offers a field whose value the
  // server silently drops — which reads to the owner as the save not working.
  const c = read("public/chat.js");
  const i = c.indexOf("const loadVerify = async () => {");
  assert.ok(i > 0, "the panel loader moved");
  const win = c.slice(i, i + 3000);
  assert.match(win, /d\.providers/, "the panel does not read the server's provider list");
  for (const n of VERIFIER_NAMES) {
    assert.ok(!win.includes("'" + n + "'") && !win.includes('"' + n + '"'),
      "the panel hardcodes the provider " + n);
  }
  // EVERY FIELD IS SENT, INCLUDING THE EMPTY ONES, because an empty field is how
  // a verification is taken off — absent would mean unchanged, and a cleared box
  // would silently keep verifying.
  // THE COLLECTOR TAKES EVERY FIELD UNCONDITIONALLY. A guard inside it — even
  // `if (i.value.trim())`, which reads like tidiness — means a cleared box is
  // absent, absent means unchanged, and the verification silently stays on.
  // Asserted on the body having no branch in it, because a substring match for
  // the selector survives exactly that mutation.
  const coll = win.match(/querySelectorAll\('\.sv-in'\)\.forEach\(\(i\) => \{([^}]*)\}\)/);
  assert.ok(coll, "the panel does not collect every field");
  assert.ok(!/\bif\b/.test(coll[1]), "the collector skips fields: " + coll[1].trim());
  assert.match(win, /d2\.live \?/, "the panel cannot tell the owner whether it is live yet");
  assert.match(win, /d2\.note \?/, "a refusal is computed and never shown");
});
