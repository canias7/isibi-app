import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  discover, safeHost, settings, parseSettings, httpsUrl, applyUrl, offerFor,
  signQuery, rsaSigner, DISCOVERY_PREFIX,
} from "../site-domain-connect.mjs";

const GD = {
  providerId: "GoDaddy",
  providerName: "GoDaddy",
  urlSyncUX: "https://dcc.godaddy.com/manage",
  urlAsyncUX: "https://sso.godaddy.com",
  urlAPI: "https://domainconnect.api.godaddy.com",
};

function net(over = {}) {
  const asked = [];
  const d = {
    fetch: async (url) => {
      asked.push(url);
      if (over.throws) throw new Error("network");
      if (url.includes("dns-query")) {
        if (over.noTxt) return { ok: true, json: async () => ({ Status: 3 }) };
        const txt = over.txt === undefined ? "domainconnect.godaddy.com" : over.txt;
        return { ok: true, json: async () => (txt === null ? { Status: 0 } : { Status: 0, Answer: [{ type: 16, data: '"' + txt + '"' }] }) };
      }
      if (over.settingsDead) return { ok: false, status: 404 };
      return { ok: true, json: async () => (over.settings === undefined ? GD : over.settings) };
    },
  };
  d.asked = asked;
  return d;
}

// ------------------------------------------------------------------ discovery

test("the discovery record names the provider's endpoint", async () => {
  const d = net();
  assert.equal(await discover(d, "shop.com"), "domainconnect.godaddy.com");
  assert.ok(d.asked[0].includes(encodeURIComponent(DISCOVERY_PREFIX + ".shop.com")), d.asked[0]);
});

test("a TXT record arrives QUOTED and is unquoted", async () => {
  // Every resolver returns TXT wrapped in quotes. Left on, the value is not a
  // hostname and the whole feature reports unsupported for everybody who has it.
  assert.equal(await discover(net({ txt: "domainconnect.ionos.com" }), "shop.com"), "domainconnect.ionos.com");
});

test("no record means the provider does not support it", async () => {
  assert.equal(await discover(net({ noTxt: true }), "shop.com"), null);
  assert.equal(await discover(net({ txt: null }), "shop.com"), null);
  assert.equal(await discover(net({ throws: true }), "shop.com"), null);
  assert.equal(await discover(net(), "localhost"), null);
});

// -------------------------------------------- the value is somebody else's

test("THE ENDPOINT IS ATTACKER-CONTROLLED, so it is treated as hostile", async () => {
  // It comes off a TXT record on a zone we do not run. We are about to fetch it
  // server-side and later send the owner's browser to a URL built from it.
  for (const evil of [
    "https://evil.example", "//evil.example", "evil.example/path", "evil.example:8080",
    "user@evil.example", "127.0.0.1", "169.254.169.254", "localhost", "", " ",
    "-bad.example", "a".repeat(64) + ".example", "javascript:alert(1)",
  ]) {
    assert.equal(safeHost(evil), null, JSON.stringify(evil));
    assert.equal(await discover(net({ txt: evil }), "shop.com"), null, JSON.stringify(evil));
  }
  assert.equal(safeHost("Domainconnect.GoDaddy.com."), "domainconnect.godaddy.com");
});

test("urlSyncUX DECIDES WHERE A BROWSER GOES, so it must be absolute https", () => {
  for (const bad of [
    "http://dcc.godaddy.com", "javascript:alert(1)", "//dcc.godaddy.com", "/manage",
    "data:text/html,x", "https://user:pw@dcc.godaddy.com", "", null, 4, "https://127.0.0.1/x",
  ]) {
    assert.equal(httpsUrl(bad), null, JSON.stringify(bad));
    // No usable sync URL and no async one either is a refusal…
    assert.equal(parseSettings({ providerId: "X", urlSyncUX: bad }), null, JSON.stringify(bad));
    // …and where there IS an async one it is the async ANSWER, never a link.
    const asy = parseSettings({ ...GD, urlSyncUX: bad });
    assert.equal(asy.asyncOnly, true, JSON.stringify(bad));
    assert.equal(asy.urlSyncUX, undefined, "and no URL to send anybody to");
    assert.equal(applyUrl(asy, { provider: "p", serviceId: "s", domain: "shop.com" }), null,
      "so a link cannot be built from it at all");
  }
  assert.equal(httpsUrl("https://dcc.godaddy.com/manage/"), "https://dcc.godaddy.com/manage");
});

test("settings with no providerId are refused", () => {
  assert.equal(parseSettings({ urlSyncUX: "https://x.example" }), null);
  assert.equal(parseSettings(null), null);
  assert.equal(parseSettings("no"), null);
  assert.equal(parseSettings({}), null);
});

test("a good settings document parses", () => {
  const s = parseSettings(GD);
  assert.equal(s.providerId, "GoDaddy");
  assert.equal(s.providerName, "GoDaddy");
  assert.equal(s.urlSyncUX, "https://dcc.godaddy.com/manage");
});

// ------------------------------------------------------------- the apply url

const base = parseSettings(GD);

test("the apply URL is the provider's own consent screen", () => {
  const u = applyUrl(base, {
    provider: "gofarther.dev", serviceId: "site", domain: "shop.com", host: "www",
    params: { target: "saas.gofarther.dev" },
  });
  const p = new URL(u.url);
  assert.equal(p.origin, "https://dcc.godaddy.com");
  assert.ok(p.pathname.includes("/v2/domainTemplates/providers/gofarther.dev/services/site/apply"), p.pathname);
  assert.equal(p.searchParams.get("domain"), "shop.com");
  assert.equal(p.searchParams.get("host"), "www");
  assert.equal(p.searchParams.get("target"), "saas.gofarther.dev");
});

test("NO CREDENTIAL OF OURS TRAVELS IN IT", () => {
  // This is what makes handing the URL to a browser safe: the worst a hostile
  // endpoint learns is the domain and the record, both of which become public
  // DNS the moment the change is applied.
  const u = applyUrl(base, {
    provider: "gofarther.dev", serviceId: "site", domain: "shop.com",
    params: { target: "saas.gofarther.dev" },
  });
  assert.ok(!/key|secret|token|password|bearer/i.test(u.url), u.url);
});

test("the group selects which half of the template gets applied", () => {
  // The template carries an APEXCNAME and a `www` CNAME in two groups, and one
  // apply must touch exactly one of them — without this the bare domain and
  // www both move whenever either is claimed, and the one that was not
  // registered as a custom hostname serves a certificate error.
  const apex = applyUrl(base, {
    provider: "gofarther.dev", serviceId: "site", domain: "shop.com", groupId: "apex",
    params: { target: "saas.gofarther.dev" },
  });
  const p = new URL(apex.url);
  assert.equal(p.searchParams.get("groupId"), "apex");
  // The apex apply carries NO host — an APEXCNAME is apex by definition, and a
  // host alongside it would move the record somewhere the template never
  // described.
  assert.equal(p.searchParams.has("host"), false);

  const www = applyUrl(base, { provider: "p", serviceId: "s", domain: "shop.com", groupId: "www" });
  assert.equal(new URL(www.url).searchParams.get("groupId"), "www");
  // Absent, not blank: a provider given an empty group has been asked for
  // every record in the template.
  const none = applyUrl(base, { provider: "p", serviceId: "s", domain: "shop.com" });
  assert.equal(new URL(none.url).searchParams.has("groupId"), false);
});

test("the signature covers the group, so a forged link cannot swap it", () => {
  // `groupId` decides which records are written. Outside the signed bytes it
  // would be the one parameter an attacker could change on a link we signed.
  const built = applyUrl(base, {
    provider: "p", serviceId: "s", domain: "shop.com", groupId: "apex",
    params: { target: "saas.gofarther.dev" },
  });
  assert.ok(built.query.includes("groupId=apex"), built.query);
});

test("an empty host is OMITTED, never sent blank", () => {
  // Sent empty it is a template variable with no value — which some providers
  // reject and others apply at the apex. Those are the two worst outcomes to be
  // picking between silently.
  const u = applyUrl(base, { provider: "p", serviceId: "s", domain: "shop.com", host: "" });
  assert.equal(new URL(u.url).searchParams.has("host"), false);
});

test("template values are ENCODED, and junk keys dropped", () => {
  // Unencoded, an `&` in a value appends a parameter of somebody else's
  // choosing to a URL the owner is about to trust.
  const u = applyUrl(base, {
    provider: "p", serviceId: "s", domain: "shop.com",
    params: { target: "a&redirect_uri=https://evil.example", "bad key": "x", ok: null },
  });
  const p = new URL(u.url);
  assert.equal(p.searchParams.get("target"), "a&redirect_uri=https://evil.example");
  assert.equal(p.searchParams.get("redirect_uri"), null, "it did not become its own parameter");
  assert.equal(p.searchParams.has("bad key"), false);
  assert.equal(p.searchParams.has("ok"), false);
});

test("a return URL must be https, and state rides only with one", () => {
  const good = applyUrl(base, { provider: "p", serviceId: "s", domain: "shop.com", redirectUri: "https://gofarther.dev/back", state: "abc" });
  assert.equal(new URL(good.url).searchParams.get("redirect_uri"), "https://gofarther.dev/back");
  assert.equal(new URL(good.url).searchParams.get("state"), "abc");
  const bad = applyUrl(base, { provider: "p", serviceId: "s", domain: "shop.com", redirectUri: "http://evil.example", state: "abc" });
  assert.equal(new URL(bad.url).searchParams.has("redirect_uri"), false);
  // WITHOUT the return URL the state proves nothing and must not be sent — it
  // would be an identifier handed to a third party for no purpose.
  assert.equal(new URL(bad.url).searchParams.has("state"), false);
});

test("missing pieces produce no URL rather than a broken one", () => {
  for (const args of [
    { provider: "p", serviceId: "s" },
    { provider: "p", domain: "shop.com" },
    { serviceId: "s", domain: "shop.com" },
  ]) {
    assert.equal(applyUrl(base, args), null, JSON.stringify(args));
  }
  assert.equal(applyUrl(null, { provider: "p", serviceId: "s", domain: "shop.com" }), null);
});

// ----------------------------------------------------------------- the offer

test("a supported provider is offered by name", async () => {
  const r = await offerFor(net(), "shop.com");
  assert.equal(r.supported, true);
  assert.equal(r.provider, "GoDaddy");
  assert.ok(r.settings.urlSyncUX);
});

test("no discovery record is simply unsupported", async () => {
  assert.deepEqual(await offerFor(net({ noTxt: true }), "shop.com"), { supported: false });
});

test("async-only is REACHABLE, which the first draft's flag was not", () => {
  // It was computed after a `return null` that made it dead. Asserted from both
  // ends now: the parse reaches it, and `offerFor` reports it.
  const s2 = parseSettings({ providerId: "X", providerName: "Xen", urlAsyncUX: "https://x.example/oauth" });
  assert.deepEqual(s2, { providerId: "X", providerName: "Xen", asyncOnly: true });
});

test("a provider offering ONLY the OAuth flow says so", async () => {
  // "Your provider supports this but needs a sign-in we have not built" is a
  // different thing from "your provider does not support this", and an owner
  // who is told the second will stop looking.
  const r = await offerFor(net({ settings: { providerId: "X", providerName: "Xen", urlAsyncUX: "https://x.example/o" } }), "shop.com");
  assert.equal(r.supported, false);
  assert.equal(r.asyncOnly, true, "and it is said, not folded into plain unsupported");
  assert.equal(r.provider, "Xen", "with the name, so the panel can use it");
  assert.equal(r.endpoint, "domainconnect.godaddy.com", "the endpoint was still found");
});

test("an endpoint that does not answer is unsupported, not a crash", async () => {
  const r = await offerFor(net({ settingsDead: true }), "shop.com");
  assert.equal(r.supported, false);
  assert.equal(r.endpoint, "domainconnect.godaddy.com");
});

test("it is a leaf module", () => {
  const src = fs.readFileSync(new URL("../site-domain-connect.mjs", import.meta.url), "utf8");
  assert.ok(!/^\s*import\s/m.test(src), "no imports");
});

// ------------------------------------------------------------ worker wiring

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const has = (src, re, why) => assert.ok(re.test(src), why);

test("the route offers one-click where the provider supports it", () => {
  has(worker, /dcOfferFor\(dnsDeps, zone\)/, "discovery runs per domain");
  has(worker, /item\.oneClick = built\.base \+ "\?" \+ signed/, "and the SIGNED link is handed over");
});

test("discovery asks at the ZONE, not the hostname", () => {
  // Both the `_domainconnect` record and the template live on the registrable
  // domain. Asked at `www.shop.com` it finds nothing, for everybody.
  has(worker, /const zone = parts\.slice\(-2\)\.join\("\."\);/, "the zone is derived");
  has(worker, /dcOfferFor\(dnsDeps, zone\)/, "and is what gets asked");
  // The subdomain picks the template GROUP rather than riding along as a
  // `host`. It used to be `host: sub`, which the standard's schema does not
  // permit for our records — see `test/domain-connect-template.test.mjs`.
  has(worker, /const dcGroup = sub === "" \? "apex" : sub === "www" \? "www" : null;/,
    "the subdomain selects a group");
  has(worker, /groupId: dcGroup/, "and the group is what reaches the apply URL");
});

test("a subdomain we have no group for is REFUSED discovery, not offered a link", () => {
  // Two things at once, and the second is the one that costs money: a lookup
  // for a hostname no group can serve is a DNS round trip per domain per panel
  // load with nothing to do with the answer.
  has(worker, /dcGroup\s*\n?\s*\? await dcOfferFor/, "discovery is gated on there being a group");
  has(worker, /otherSubdomain: true/, "and the reason is carried, not swallowed");
  has(chat, /oneClickBlocked/, "and the panel says it");
});

// THE TEMPLATE'S OWN SHAPE IS ASSERTED IN `test/domain-connect-template.test.mjs`,
// against the UPSTREAM SCHEMA, and two tests that lived here were deleted when it
// landed rather than repaired. Both restated the schema by hand — a required-field
// list and an allowed-field set, copied by a reader — and both said `records` was
// one CNAME at `@`. That combination is INVALID under the real schema, which
// refuses an apex CNAME unless a host is mandatory. So the hand-copied pair passed
// while the file it guarded would have been rejected on review: the failure this
// codebase keeps recording, where a restated fact is worse than no fact.

test("our template identity is named ONCE", () => {
  // `providerId`/`serviceId` are the path a provider looks our template up by,
  // and they have to match what is registered in the Domain Connect Templates
  // repository. Two copies is a 404 at their end that nobody can reproduce.
  // Counted on CODE, not on the name: the comment above the constants mentions
  // both, so a bare-name count reads prose and reports three. Same trap as
  // every other source guard here — anchor on the syntax.
  has(worker, /const DC_PROVIDER = "gofarther\.dev";/, "declared");
  has(worker, /const DC_SERVICE = "site";/, "declared");
  assert.equal((worker.match(/const DC_PROVIDER =/g) || []).length, 1, "defined once");
  assert.equal((worker.match(/const DC_SERVICE =/g) || []).length, 1, "defined once");
  assert.equal((worker.match(/provider: DC_PROVIDER, serviceId: DC_SERVICE/g) || []).length, 1, "and used in one place");
});

test("it is not offered once DNS already points here", () => {
  // There would be nothing for the provider to apply, and a "set it up" button
  // on a finished domain invites somebody to redo work already done.
  const i = worker.indexOf('if (chk.state !== "ok") {');
  const j = worker.indexOf("dcOfferFor(dnsDeps, zone)");
  assert.ok(i > 0 && j > i, "the offer is inside the not-ok branch");
});

test("SIGNED OR NOT OFFERED — never an unsigned link", () => {
  // The template declares `syncPubKeyDomain`, so a provider REFUSES an unsigned
  // apply URL. Falling back to one would be a button that always fails; falling
  // back to nothing leaves the copyable records, which work.
  // Anchored on the SHAPE, not the variable's name — a rename broke this once
  // and a rename must not be able to break a security assertion.
  const i = worker.search(/const signed = built && \w+ \? await dcSign\(/);
  assert.ok(i > 0, "the link is signed");
  const after = worker.slice(i, i + 400);
  assert.ok(/if \(signed\) \{ item\.oneClick/.test(after), "and only a signed one is offered");
  // No branch anywhere hands over `built.url`, which is the unsigned form.
  assert.ok(!/item\.oneClick = built\.url/.test(worker), "the unsigned URL is never offered");
});

test("the key id is named once, and matches what gets published in DNS", () => {
  // Providers fetch the public half from `<DC_KEY_ID>.<syncPubKeyDomain>`.
  has(worker, /const DC_KEY_ID = "_dck1";/, "declared");
  assert.equal((worker.match(/const DC_KEY_ID =/g) || []).length, 1, "once");
  const t = JSON.parse(fs.readFileSync(new URL("../domain-connect/gofarther.dev.site.json", import.meta.url), "utf8"));
  assert.equal(t.syncPubKeyDomain, "gofarther.dev", "and the template names the zone it lives in");
});

test("the signing key is a deployed secret, not something in the repo", () => {
  const deploy = fs.readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
  // The PROPERTY — the value comes from GitHub secrets — rather than one exact
  // spelling of the expression. Pinned to the exact string, this went red when a
  // `|| fallback` was added to stop an unset secret failing the whole deploy:
  // a test about where the key comes from, failing over word order. The
  // fallback's own safety is asserted in `test/deploy-secrets.test.mjs`.
  assert.match(deploy, /DOMAIN_CONNECT_KEY:\s*\$\{\{\s*secrets\.DOMAIN_CONNECT_KEY\b/, "uploaded from GitHub secrets");
  has(worker, /env\.DOMAIN_CONNECT_KEY/, "and read from env");
  // A private key checked in would be a private key in git forever.
  assert.ok(!/BEGIN (RSA )?PRIVATE KEY/.test(worker), "no key material in the source");
});

test("an async-only provider is SAID, not silently dropped", () => {
  has(worker, /item\.oneClickBlocked = "asyncOnly"/, "recorded for the panel");
});

test("the panel shows the button above the manual records", () => {
  // It replaces them: an owner who can press this never has to look at a CNAME.
  const btn = chat.indexOf("Set it up at ");
  const recs = chat.indexOf("const recs = live ?");
  assert.ok(btn > 0 && recs > 0);
  const row = chat.indexOf("dnsRow + oneClick + provRow");
  assert.ok(row > 0, "and it is placed before the records in the rendered order");
});

test("the button says the owner keeps their password", () => {
  // The reassurance is load-bearing: this sends somebody to a sign-in screen,
  // and the reason it is safe is that the sign-in is THEIRS.
  has(chat, /never see your password/, "stated in the panel");
});

// ------------------------------------------------------- the template itself
//
// It is a file a THIRD PARTY reviews and every DNS provider then ingests, so a
// mistake in it is not something we can fix by deploying — it is a resubmission
// and another review cycle.

test("the template matches what the code asks providers for", () => {
  const t = JSON.parse(fs.readFileSync(new URL("../domain-connect/gofarther.dev.site.json", import.meta.url), "utf8"));
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // THE PATH A PROVIDER LOOKS US UP BY. If these drift from the constants the
  // apply URL is built with, every button 404s at the provider's end — and the
  // template cannot be corrected without another review.
  assert.ok(worker.includes('const DC_PROVIDER = "' + t.providerId + '"'), "providerId matches DC_PROVIDER");
  assert.ok(worker.includes('const DC_SERVICE = "' + t.serviceId + '"'), "serviceId matches DC_SERVICE");
  // And the variable the apply URL sends must be one the template declares.
  assert.ok(worker.includes("params: { target: saasTarget(env) }"), "the code sends `target`");
  assert.ok(JSON.stringify(t.records).includes("%target%"), "and the template consumes it");
});


test("syncRedirectDomain is set, and is not a wildcard", () => {
  // It is the allow-list of hosts a provider will honour in `redirect_uri`.
  // Absent or wildcarded, the apply URL is an open redirect anybody can aim
  // anywhere, on the provider's domain, carrying our template's name.
  const t = JSON.parse(fs.readFileSync(new URL("../domain-connect/gofarther.dev.site.json", import.meta.url), "utf8"));
  assert.ok(typeof t.syncRedirectDomain === "string" && t.syncRedirectDomain.length, "declared");
  assert.ok(!t.syncRedirectDomain.includes("*"), "never a wildcard");
  for (const h of t.syncRedirectDomain.split(",")) {
    assert.ok(/^[a-z0-9.-]+$/.test(h.trim()), h);
    assert.ok(h.trim().endsWith("gofarther.dev"), h + " must be ours");
  }
});

test("providerId is a domain we actually control", () => {
  // What a reviewer checks, and the only thing tying the template to us.
  const t = JSON.parse(fs.readFileSync(new URL("../domain-connect/gofarther.dev.site.json", import.meta.url), "utf8"));
  assert.equal(t.providerId, "gofarther.dev");
});

// --------------------------------------------------------------- signing

test("the signature covers the query EXACTLY as it will be sent", async () => {
  // Rebuilt for signing, the bytes could differ from the bytes on the wire —
  // different escaping, different parameter order — and every signature would
  // fail verification for a reason nobody could see from either end.
  const seen = [];
  const built = applyUrl(base, {
    provider: "p", serviceId: "s", domain: "shop.com", host: "www",
    params: { target: "saas.gofarther.dev" },
  });
  const signed = await signQuery({ sign: async (q) => { seen.push(q); return "SIGVALUE=="; } }, built.query, "_dck1");
  assert.equal(seen.length, 1);
  assert.equal(seen[0], built.query, "signed the string that goes on the wire");
  assert.ok(!/[?]/.test(seen[0]), "the query only, without the leading ?");
  assert.ok(!/(^|&)(sig|key)=/.test(seen[0]), "and without sig/key, which are added after");
  const u = new URL(built.base + "?" + signed);
  assert.equal(u.searchParams.get("sig"), "SIGVALUE==");
  assert.equal(u.searchParams.get("key"), "_dck1");
});

test("no signature means no signed URL, rather than an unsigned one passed off as signed", async () => {
  assert.equal(await signQuery({ sign: async () => null }, "domain=x"), null);
  assert.equal(await signQuery({}, "domain=x"), null);
  assert.equal(await signQuery({ sign: async () => "s" }, ""), null);
});

test("the signer produces a verifiable RSA-SHA256 signature", async () => {
  // Driven with a REAL key pair rather than a fake, and verified with WebCrypto
  // — the same lesson as the passkey tests: a signer checked against itself
  // proves only that it agrees with itself, and a provider will not.
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true, ["sign", "verify"]);
  const pkcs8 = Buffer.from(await crypto.subtle.exportKey("pkcs8", pair.privateKey)).toString("base64");
  const sign = await rsaSigner(pkcs8);
  assert.ok(sign, "the key imported");
  const query = "domain=shop.com&host=www&target=saas.gofarther.dev";
  const sig = await sign(query);
  assert.ok(sig && sig.length > 100, "something came back");
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", pair.publicKey,
    Uint8Array.from(atob(sig), (c) => c.charCodeAt(0)), new TextEncoder().encode(query));
  assert.equal(ok, true, "and it verifies against the public half");
  // A DIFFERENT query must not verify, or the signature is decoration.
  const bad = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", pair.publicKey,
    Uint8Array.from(atob(sig), (c) => c.charCodeAt(0)), new TextEncoder().encode(query + "&evil=1"));
  assert.equal(bad, false);
});

test("a key that will not import is null, not a crash on a public route", async () => {
  for (const bad of ["", null, "not base64 at all!!", "aGVsbG8="]) {
    assert.equal(await rsaSigner(bad), null, JSON.stringify(bad));
  }
});

test("THE TEMPLATE SIGNS RATHER THAN WARNS, and the two cannot coexist", () => {
  // Their reviewer checklist: `syncPubKeyDomain` is mandatory and omitting it
  // needs justification or the PR is rejected; `warnPhishing` must not appear
  // alongside it. The first draft had exactly the wrong pair — no key domain
  // and a phishing warning — which would have been rejected AND left our own
  // legitimate flow showing an interstitial.
  const t = JSON.parse(fs.readFileSync(new URL("../domain-connect/gofarther.dev.site.json", import.meta.url), "utf8"));
  assert.equal(t.syncPubKeyDomain, "gofarther.dev", "signed");
  assert.equal(t.warnPhishing, undefined, "and therefore no phishing warning");
});


test("the file is named the way the repository requires", () => {
  // `providerId.serviceId.json` in the repository ROOT. The first draft of the
  // README said `templates/`, which is wrong and would have been a review
  // comment rather than a merge.
  const t = JSON.parse(fs.readFileSync(new URL("../domain-connect/gofarther.dev.site.json", import.meta.url), "utf8"));
  const names = fs.readdirSync(new URL("../domain-connect/", import.meta.url));
  assert.ok(names.includes(t.providerId + "." + t.serviceId + ".json"), names.join(", "));
});

test("the logo the template advertises actually exists in the build", () => {
  // A reviewer opens it. A 404 there is a bounced submission for a reason that
  // has nothing to do with DNS.
  const t = JSON.parse(fs.readFileSync(new URL("../domain-connect/gofarther.dev.site.json", import.meta.url), "utf8"));
  const m = String(t.logoUrl).match(/^https:\/\/gofarther\.dev\/(.+)$/);
  assert.ok(m, "served from our own origin: " + t.logoUrl);
  assert.ok(fs.existsSync(new URL("../public/" + m[1], import.meta.url)), "public/" + m[1] + " must exist");
});

test("the signer is built ONCE per request, not once per domain", () => {
  // Importing an RSA key is not free and this built the same signer inside the
  // per-domain loop. Anchored on the loop boundary rather than on a line count,
  // so it stays true if the block moves.
  // From AFTER the hoisted build to the response — the slice must not contain
  // the one legitimate call, or "no calls in the loop" is false by construction.
  const hoisted = worker.indexOf("const dcSign1 = env.DOMAIN_CONNECT_KEY");
  assert.ok(hoisted > 0, "the hoisted signer is gone");
  const loop = worker.slice(worker.indexOf("\n", hoisted), worker.indexOf("signing: !!dcSign1"));
  const builds = loop.match(/await dcSigner\(/g) || [];
  assert.equal(builds.length, 0, "dcSigner is called again inside the loop");
  assert.match(worker, /const dcSign1 = env\.DOMAIN_CONNECT_KEY \? await dcSigner\(env\.DOMAIN_CONNECT_KEY\) : null;/);
});

test("the panel is TOLD whether this platform can sign at all", () => {
  // Without it, no button is ambiguous: "your DNS provider does not support
  // this" and "this platform has no signing key" look identical, and only the
  // second is our fault. That ambiguity is how a missing key stays missing —
  // which is the failure mode this whole file keeps recording.
  has(worker, /signing: !!dcSign1/, "the domains response reports it");
  // A BOOLEAN, never the key or any part of it.
  assert.ok(!/DOMAIN_CONNECT_KEY[^\n]*body|body[^\n]*DOMAIN_CONNECT_KEY/.test(worker),
    "the key itself must never reach a response body");
});
