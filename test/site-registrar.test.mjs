import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { providerFor, detectProvider, providerSentence, PROVIDERS } from "../site-registrar.mjs";

function resolver(table, over = {}) {
  const asked = [];
  const d = {
    fetch: async (url) => {
      const zone = new URL(url).searchParams.get("name");
      asked.push(zone);
      if (over.dead) return { ok: false, status: 502 };
      if (over.throws) throw new Error("network");
      const ns = table[zone];
      return { ok: true, json: async () => (ns ? { Status: 0, Answer: ns.map((n) => ({ type: 2, data: n })) } : { Status: 0 }) };
    },
  };
  d.asked = asked;
  return d;
}

// -------------------------------------------------------- naming the provider

test("the providers people actually use are recognised", () => {
  for (const [ns, id] of [
    ["ns01.domaincontrol.com", "godaddy"],
    ["NS73.DOMAINCONTROL.COM.", "godaddy"],
    ["kim.ns.cloudflare.com", "cloudflare"],
    ["dns1.registrar-servers.com", "namecheap"],
    ["ns-1234.awsdns-56.org", "route53"],      // the brand is MID-LABEL here
    ["ns1-01.azure-dns.com", "azure"],
    ["ns1075.ui-dns.com", "ionos"],
    ["ns1.vercel-dns.com", "vercel"],
    ["dns1.p01.nsone.net", "netlify"],
    ["ns2.wixdns.net", "wix"],
    ["ns1.squarespacedns.com", "squarespace"],
    ["ns1.porkbun.com", "porkbun"],
    ["hydrogen.ns.hetzner.com", "hetzner"],
  ]) {
    const p = providerFor([ns]);
    assert.ok(p, ns);
    assert.equal(p.id, id, ns);
  }
});

test("A WRONG NAME IS WORSE THAN NO NAME, so the suffix is anchored", () => {
  // Unanchored, `name.com` matches `myname.com` and `he.net` matches almost
  // everything — and telling somebody their DNS is at a company they have never
  // heard of sends them to sign into an account they do not have.
  assert.equal(providerFor(["ns1.myname.com"]), null);
  assert.equal(providerFor(["ns1.notgandi.net"]), null);
  assert.equal(providerFor(["dns.somethinghe.net"]), null);
  assert.equal(providerFor(["ns1.cloudflare.com.evil.net"]), null);
  // …and the real ones still match, or the anchor has gone too far.
  assert.equal(providerFor(["ns1.name.com"]).id, "namedotcom");
  assert.equal(providerFor(["ns1.he.net"]).id, "he");
});

test("a domain still on a parking page gets its own answer", () => {
  // It resolves, so the DNS check calls it `elsewhere` and tells the owner to
  // change a record that does not exist. "Never set up" is a different and much
  // more encouraging thing to be told.
  const p = providerFor(["ns1.sedoparking.com", "ns2.sedoparking.com"]);
  assert.equal(p.id, "parked");
  assert.match(providerSentence({ state: "known", provider: p }), /parked/i);
});

test("nothing to go on is null, not a guess", () => {
  for (const bad of [[], null, undefined, [""], ["ns1.some-tiny-host.example"]]) {
    assert.equal(providerFor(bad), null, JSON.stringify(bad));
  }
});

test("every entry is complete, and claims no automation", () => {
  // Derived over the table, so a provider added later cannot arrive half-filled
  // — and `api: true` is a promise the panel will make to a customer.
  const ids = new Set();
  for (const p of PROVIDERS) {
    assert.ok(/^[a-z0-9]+$/.test(p.id), p.id);
    assert.ok(!ids.has(p.id), "duplicate id " + p.id);
    ids.add(p.id);
    assert.ok(p.name && p.name.length > 1, p.id);
    // One match form or the other, and `part` is the loose one — an entry with
    // neither matches nothing and is a provider silently absent from the list.
    assert.ok((p.ns || []).length || (p.part || []).length, p.id + " must have something to match on");
    // NO `api` FIELD, asserted. One existed, uniformly false, which made the
    // panel's `true` branch dead code and the field itself the
    // declared-and-read-by-nothing shape this repo keeps recording. It comes
    // back the day a real authorization flow does.
    assert.equal(p.api, undefined, p.id + " must not claim automation that does not exist");
    // A deep link into the records page, not a marketing home page: landing
    // somebody on one three minutes into a task is the same as no link.
    assert.ok(/^https:\/\//.test(p.dns), p.id);
    assert.ok(p.dns.split("/").length > 3 || p.dns.includes("?"), p.id + " must link into the app, not the front page");
  }
});

// ------------------------------------------------------------- the lookup

test("NS is asked at the registrable domain, not the hostname", () => {
  // `www.shop.com` has no NS records of its own; `shop.com` does. Asking at the
  // hostname would report "unknown provider" for every single www.
  return detectProvider(resolver({ "shop.com": ["ns01.domaincontrol.com"] }), "www.shop.com")
    .then((r) => {
      assert.equal(r.state, "known");
      assert.equal(r.provider.id, "godaddy");
    });
});

test("it walks up one more label for a multi-part suffix", async () => {
  // Two labels is right for `shop.com` and wrong for `shop.co.uk`. Trying the
  // parent covers both without shipping the public suffix list.
  const d = resolver({ "shop.co.uk": ["ns1.registrar-servers.com"] });
  const r = await detectProvider(d, "www.shop.co.uk");
  assert.equal(r.provider.id, "namecheap");
  assert.deepEqual(d.asked, ["co.uk", "shop.co.uk"], "the two-label guess first, then the parent");
});

test("an UNRECOGNISED provider still returns the nameservers", () => {
  // "Your DNS is at ns1.theirhost.net" is enough for somebody to recognise
  // their own hosting company — and it is what tells us which entry to add to
  // the table next.
  return detectProvider(resolver({ "shop.com": ["ns1.some-small-host.net"] }), "shop.com").then((r) => {
    assert.equal(r.state, "unrecognised");
    assert.deepEqual(r.nameservers, ["ns1.some-small-host.net"]);
    assert.match(providerSentence(r), /ns1\.some-small-host\.net/);
  });
});

test("a resolver failure is unknown and says nothing", async () => {
  for (const over of [{ dead: true }, { throws: true }]) {
    const r = await detectProvider(resolver({}, over), "shop.com");
    assert.equal(r.state, "unknown", JSON.stringify(over));
    assert.equal(providerSentence(r), "", "and the panel shows no line at all");
  }
});

test("a name with no NS anywhere is unknown, not a wrong guess", async () => {
  assert.equal((await detectProvider(resolver({}), "shop.com")).state, "unknown");
  assert.equal((await detectProvider(resolver({}), "localhost")).state, "unknown");
});

test("the sentence never claims something it does not know", () => {
  assert.equal(providerSentence(null), "");
  assert.equal(providerSentence({ state: "unknown" }), "");
  assert.equal(providerSentence({ state: "unrecognised", nameservers: [] }), "");
  assert.match(providerSentence({ state: "known", provider: { name: "GoDaddy" } }), /GoDaddy/);
});

test("it is a leaf module", () => {
  const src = fs.readFileSync(new URL("../site-registrar.mjs", import.meta.url), "utf8");
  assert.ok(!/^\s*import\s/m.test(src), "no imports");
});

// ------------------------------------------------------------ worker wiring

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const has = (src, re, why) => assert.ok(re.test(src), why);

test("the route detects who holds the DNS", () => {
  has(worker, /detectProvider\(dnsDeps, row\.hostname\)/, "asked per domain");
  has(worker, /item\.providerNote = note/, "and the sentence is handed over");
  has(worker, /item\.providerUrl = who\.provider\.dns/, "with the deep link");
});

test("the panel shows it, with the way in", () => {
  has(chat, /x\.providerNote/, "the line renders");
  has(chat, /Open ' \+ esc\(x\.provider \|\| 'DNS'\)/, "and names the provider on the button");
});

test("NO AUTO-CONFIGURE BUTTON IS OFFERED, because none would work", () => {
  // Writing a customer's records needs a credential they grant us through a
  // flow that does not exist. A panel that offers to automate something it
  // cannot is worse than one that never offered — and the link IS the
  // automation that exists today.
  assert.ok(!/[Aa]uto.?configure/.test(chat.slice(chat.indexOf("async function siteDomains"), chat.indexOf("async function siteDomains") + 7000)),
    "the panel makes no promise it cannot keep");
});
