import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { checkDns, dnsSentence, DOH } from "../site-dns.mjs";

const TARGET = "saas.gofarther.dev";

/**
 * A fake resolver driven by a table of `name|TYPE` → answer.
 *
 * Records every question asked, because HOW MANY lookups happen is part of the
 * contract: the apex path costs two extra, and doing them on every check would
 * be three round trips on a panel refresh.
 */
function resolver(table, over = {}) {
  const asked = [];
  const d = {
    fetch: async (url) => {
      const u = new URL(url);
      const key = u.searchParams.get("name") + "|" + u.searchParams.get("type");
      asked.push(key);
      if (over.dead) return { ok: false, status: 502 };
      if (over.throws) throw new Error("network");
      const hit = table[key];
      if (hit === undefined) return { ok: true, json: async () => ({ Status: 3 }) };   // NXDOMAIN
      return { ok: true, json: async () => hit };
    },
  };
  d.asked = asked;
  return d;
}
const cname = (v) => ({ Status: 0, Answer: [{ type: 5, data: v }] });
const a = (...ips) => ({ Status: 0, Answer: ips.map((ip) => ({ type: 1, data: ip })) });

// ------------------------------------------------------------------ pointing

test("a CNAME at us is OK, and costs ONE lookup", async () => {
  const d = resolver({ "www.shop.com|CNAME": cname("saas.gofarther.dev.") });
  const r = await checkDns(d, { hostname: "www.shop.com", target: TARGET });
  assert.equal(r.state, "ok");
  assert.equal(r.via, "CNAME");
  // The subdomain case is the common one and must not pay for the apex path.
  assert.deepEqual(d.asked, ["www.shop.com|CNAME"]);
});

test("the trailing dot DNS actually returns does not break the comparison", async () => {
  // Every resolver returns `saas.gofarther.dev.` with a root dot. Comparing raw
  // would report a correct setup as pointing somewhere else — which is the
  // single most confusing thing this tool could say.
  for (const v of ["saas.gofarther.dev.", "saas.gofarther.dev", "SAAS.GoFarther.DEV."]) {
    const d = resolver({ "www.shop.com|CNAME": cname(v) });
    assert.equal((await checkDns(d, { hostname: "www.shop.com", target: TARGET })).state, "ok", v);
  }
});

test("a CNAME into our zone counts as pointing here", async () => {
  // MUTATION-DRIVEN: dropping the suffix half of the match survived everything,
  // because nothing exercised a chain. It is a real DNS shape — a record at
  // `<anything>.saas.gofarther.dev` is still our zone and still us — so the
  // branch was given a test rather than deleted the way the unreachable `*` and
  // `@` guards in site-domains were.
  const d = resolver({ "www.shop.com|CNAME": cname("abc123.saas.gofarther.dev.") });
  assert.equal((await checkDns(d, { hostname: "www.shop.com", target: TARGET })).state, "ok");
  // …and the suffix must be anchored on a DOT, or somebody registering
  // `evilsaas.gofarther.dev`-shaped names elsewhere would read as us.
  const e = resolver({ "www.shop.com|CNAME": cname("saas.gofarther.dev.evil.com.") });
  assert.equal((await checkDns(e, { hostname: "www.shop.com", target: TARGET })).state, "elsewhere");
});

test("a CNAME somewhere ELSE names what they have got", async () => {
  // The most useful answer in the file: they have a record and it is wrong,
  // which is a different problem from having none — and they cannot fix it
  // without being told what is there.
  const d = resolver({ "www.shop.com|CNAME": cname("shops.myoldhost.com.") });
  const r = await checkDns(d, { hostname: "www.shop.com", target: TARGET });
  assert.equal(r.state, "elsewhere");
  assert.equal(r.points, "shops.myoldhost.com");
});

test("no record at all is MISSING, not elsewhere", async () => {
  const d = resolver({});
  const r = await checkDns(d, { hostname: "www.shop.com", target: TARGET });
  assert.equal(r.state, "missing");
  assert.ok(r.reason);
});

test("a name that exists with no address is missing too", async () => {
  // NOERROR with an empty answer. Different rcode, same thing to do about it.
  const d = resolver({ "www.shop.com|CNAME": { Status: 0 }, "www.shop.com|A": { Status: 0 } });
  assert.equal((await checkDns(d, { hostname: "www.shop.com", target: TARGET })).state, "missing");
});

// ---------------------------------------------------------------- the apex

test("AN APEX RESOLVES TO ADDRESSES, and is still OK", async () => {
  // A bare domain cannot hold a CNAME. A provider's flattening turns it into A
  // records, so asking only for a CNAME would report `missing` for a domain
  // that is set up perfectly — which is exactly where owners need this most.
  const d = resolver({
    "shop.com|A": a("104.18.1.1", "104.18.2.2"),
    [TARGET + "|A"]: a("104.18.2.2"),
  });
  const r = await checkDns(d, { hostname: "shop.com", target: TARGET });
  assert.equal(r.state, "ok");
  assert.equal(r.via, "A");
});

test("the target's addresses are RESOLVED, never hardcoded", async () => {
  // Cloudflare's anycast ranges are not ours to pin: a baked-in list would
  // start calling correct setups wrong the day they change.
  const d = resolver({ "shop.com|A": a("1.2.3.4"), [TARGET + "|A"]: a("1.2.3.4") });
  assert.equal((await checkDns(d, { hostname: "shop.com", target: TARGET })).state, "ok");
  assert.ok(d.asked.includes(TARGET + "|A"), "our own address is looked up");
});

test("an apex pointing at the old host is elsewhere", async () => {
  const d = resolver({ "shop.com|A": a("203.0.113.9"), [TARGET + "|A"]: a("104.18.2.2") });
  const r = await checkDns(d, { hostname: "shop.com", target: TARGET });
  assert.equal(r.state, "elsewhere");
  assert.equal(r.points, "203.0.113.9");
});

// -------------------------------------------------------- the resolver fails

test("a resolver failure is UNKNOWN, never a verdict", async () => {
  // A third party on a path an owner waits on. Telling somebody their DNS is
  // wrong because a resolver was slow is worse than saying nothing.
  for (const over of [{ dead: true }, { throws: true }]) {
    const r = await checkDns(resolver({}, over), { hostname: "www.shop.com", target: TARGET });
    assert.equal(r.state, "unknown", JSON.stringify(over));
    assert.notEqual(r.state, "missing");
    assert.notEqual(r.state, "elsewhere");
  }
});

test("not being able to resolve OUR OWN address is unknown too", async () => {
  // Without the comparison set there is no verdict to give, and guessing here
  // would report every apex as wrong.
  const d = resolver({ "shop.com|A": a("1.2.3.4") });
  assert.equal((await checkDns(d, { hostname: "shop.com", target: TARGET })).state, "unknown");
});

test("nothing to look up is unknown, not missing", async () => {
  for (const args of [{ hostname: "", target: TARGET }, { hostname: "x.com", target: "" }, {}]) {
    assert.equal((await checkDns(resolver({}), args)).state, "unknown", JSON.stringify(args));
  }
});

// ------------------------------------------------------------- the sentence

test("every verdict has a sentence somebody can act on", () => {
  assert.match(dnsSentence({ state: "ok" }, TARGET), /certificate/i);
  const el = dnsSentence({ state: "elsewhere", points: "shops.myoldhost.com", via: "CNAME" }, TARGET);
  assert.match(el, /shops\.myoldhost\.com/, "it names what is there");
  assert.match(el, new RegExp(TARGET.replace(/\./g, "\\.")), "and what it should be");
  assert.match(dnsSentence({ state: "missing" }, TARGET), /hour/i, "and that propagation takes time");
  // UNKNOWN MUST NOT ALARM. It is our resolver failing, not their domain.
  const un = dnsSentence({ state: "unknown" }, TARGET);
  assert.match(un, /doesn.t mean anything is wrong/i);
  assert.equal(dnsSentence(null, TARGET), un, "an absent check reads the same as unknown");
});

test("it is a leaf module, like site-domains", () => {
  const src = fs.readFileSync(new URL("../site-dns.mjs", import.meta.url), "utf8");
  assert.ok(!/^\s*import\s/m.test(src), "no imports");
  assert.ok(DOH.startsWith("https://"), "and it asks over https");
});

// ------------------------------------------------------------ worker wiring
//
// Searched RAW — blanking comments in worker.js eats from any `/*` inside a
// string to the next `*/`. Every pattern carries a `(` or a quote.

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const has = (src, re, why) => assert.ok(re.test(src), why);

test("the panel asks what the domain really points at", () => {
  has(worker, /checkDns\(\{ fetch:/, "the list route resolves it live");
  has(worker, /item\.dnsNote = dnsSentence\(/, "and hands over the sentence");
});

test("…but only while it is unresolved", () => {
  // A live domain resolves to us by definition. Two lookups to confirm what the
  // certificate already proves is a slower panel for nothing.
  const i = worker.indexOf("if (item.status !== \"live\") {");
  const j = worker.indexOf("checkDns({ fetch:");
  assert.ok(i > 0 && j > i, "the check is inside the not-live branch");
});

test("THE CRON FINISHES THE SETUP, which is the whole feature", () => {
  // Without it the panel is honest and passive: right whenever the owner opens
  // it, and doing nothing whenever they do not. The last step of putting a
  // business on its own domain became "keep refreshing".
  has(worker, /ctx\.waitUntil\(runDomainWatch\(env\)\)/, "it runs on the tick");
  has(worker, /async function runDomainWatch\(env\)/, "and is defined");
  has(worker, /status=eq\.pending&cf_id=not\.is\.null/, "over the domains still in flight");
});

test("the mail is sent EXACTLY ONCE, by construction", () => {
  // No `notified` column to fall out of step. The mail is tied to the
  // pending → live transition, and the update that sends it is the same update
  // that stops the row being pending — so a second isolate on the same tick
  // claims nothing and sends nothing.
  const i = worker.indexOf("async function runDomainWatch(");
  const fn = worker.slice(i, i + 4200);
  assert.ok(/&status=eq\.pending`, \{\s*method: "PATCH"/.test(fn.replace(/\n\s*/g, " ")) ||
    /status=eq\.pending`,[\s\S]{0,80}method: "PATCH"/.test(fn), "the update is conditional on still being pending");
  assert.ok(/Prefer: "return=representation"/.test(fn), "and it reads back what it claimed");
  assert.ok(/if \(!Array\.isArray\(claimed\) \|\| !claimed\.length\) continue;/.test(fn), "nothing claimed, nothing sent");
  const claim = fn.indexOf("claimed");
  const mail = fn.indexOf("mailDomainLive");
  assert.ok(claim > 0 && mail > claim, "the mail comes after the claim");
});

test("a failed LOOKUP is not a failed DOMAIN", () => {
  // Left pending it is retried in two minutes; written as failed, the owner is
  // told their correct setup is broken because an API call timed out.
  const i = worker.indexOf("async function runDomainWatch(");
  const fn = worker.slice(i, i + 4200);
  assert.ok(/if \(!cf\.ok\) continue;/.test(fn), "an unreachable provider changes nothing");
});

test("the batch is bounded, because it shares a tick with three other jobs", () => {
  const i = worker.indexOf("async function runDomainWatch(");
  assert.ok(/&limit=20/.test(worker.slice(i, i + 4200)));
});

test("the panel says the owner can leave", () => {
  // The email is the point of the watcher; a panel that does not mention it
  // still trains people to sit and refresh.
  has(chat, /email you when it/, "the intro promises the mail");
});

test("work already done stops being shown as work to do", () => {
  // Not just once the domain is LIVE. Leaving the CNAME up while only the
  // certificate is outstanding sends somebody back to their registrar to fix a
  // record that is already right.
  has(chat, /const dnsDone = live \|\| x\.dns === 'ok';/, "dns-correct counts as done");
  has(chat, /dnsDone \? \[\] : \(x\.records \|\| \[\]\)/, "and its records are dropped");
});
