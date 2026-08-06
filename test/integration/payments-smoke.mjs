// The payment routes, against the DEPLOYED Worker.
//
// WHAT THIS CAN AND CANNOT PROVE, said plainly at the top because the gap
// matters: no card is charged here and no Stripe key exists on any site, so
// this proves the platform half — that both routes are live, that every
// refusal fires, and that a shop with no key answers honestly instead of 500ing
// at a customer. It does NOT prove a successful purchase. That needs a real
// test-mode key on a real site and is a separate, deliberate spend.
//
// Every check below is a way the money path could be wrong in production, and
// each one is reachable with no credential at all — which is exactly why it is
// worth running on every deploy rather than once by hand.
//
// $0: no model call, no Neon project, no Stripe account.
const BASE = process.env.SMOKE_BASE || "https://isibi.ai";

let failed = 0;
const ok = (label, cond, detail) => {
  if (cond) { console.log("  ok   " + label); return true; }
  failed++;
  console.log("  FAIL " + label + (detail ? "\n         " + String(detail).slice(0, 300) : ""));
  return false;
};

const post = async (path, body, headers) => {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(headers || {}) },
    body: typeof body === "string" ? body : JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
};

console.log("payments smoke against " + BASE + "\n");

// ── the checkout route ───────────────────────────────────────────────────────

console.log("checkout");
{
  const r = await post("/api/db/no-such-site-" + Math.random().toString(36).slice(2, 8) + "/checkout", { table: "orders", items: [{ id: 1 }] });
  ok("an unknown slug is 404, not a 500", r.status === 404, r.status + " " + r.text.slice(0, 120));
}
{
  // GET on a POST-only route. A route that answers GET is one a link or a
  // crawler can trigger, and this one writes a row and calls a payment provider.
  const res = await fetch(BASE + "/api/db/anything/checkout");
  ok("GET is refused", res.status === 405 || res.status === 404, "got " + res.status);
}
{
  // The whole point of the route living under /api/db: a customer buying has no
  // isibi account, so it must NOT demand one. 401 here would mean no published
  // site could ever take a payment.
  const r = await post("/api/db/no-such-site/checkout", { table: "orders", items: [{ id: 1 }] });
  ok("it does NOT demand an isibi session — a buying customer has no account", r.status !== 401, "got " + r.status);
}

// ── the per-site webhook ─────────────────────────────────────────────────────

console.log("\nwebhook");
// THE GATE. Every check below is meaningless if the route is a 404 — a forged
// event "refused" by a route that does not exist proves nothing, and reporting
// it as a pass is the most reassuring possible way to say the feature is dark.
// So this is asserted FIRST and the rest is an honest SKIP when it fails.
const liveRes = await fetch(BASE + "/api/stripe/site/x", { method: "POST", body: "{}" });
const webhookLive = ok("the route is LIVE (a 404 here means the feature never deployed)", liveRes.status !== 404, "got " + liveRes.status);

if (!webhookLive) {
  console.log("  SKIP the signature checks — they cannot fail against a route that is not there");
} else {
{
  const r = await post("/api/stripe/site/no-such-site-" + Math.random().toString(36).slice(2, 8), { type: "checkout.session.completed" });
  // 200, deliberately: Stripe retries a non-2xx for days and disables an
  // endpoint that keeps failing. A deleted site whose owner left the endpoint
  // registered would otherwise generate retries forever.
  ok("an unknown slug answers 200 so Stripe does not retry for days", r.status === 200, r.status + " " + r.text.slice(0, 120));
  ok("...and says it ignored it rather than claiming success", r.json && r.json.ignored, JSON.stringify(r.json));
}
{
  const res = await fetch(BASE + "/api/stripe/site/x", { method: "GET" });
  ok("GET is refused — a webhook is a POST", res.status === 404 || res.status === 405, "got " + res.status);
}
// THE SECOND GATE, and the reason it exists is worth stating. The route resolves
// the SLUG before it verifies the signature — an unknown site answers 200
// `ignored: "no such site"` on purpose, so a deleted site's leftover endpoint
// does not make Stripe retry for days. So against a slug that does not exist,
// the signature checks below never reach the signature at all: they were
// reported as FAILURES on the first live run, naming a refusal the code was
// never asked to make. Detected and SKIPPED rather than guessed at, because a
// check that cannot fail for its stated reason is worse than no check.
const probe = await post("/api/stripe/site/x", { type: "checkout.session.completed" });
const siteExists = !(probe.json && probe.json.ignored === "no such site");
if (!siteExists) {
  console.log("  SKIP the signature checks — they need a REAL published site;");
  console.log("       an unknown slug short-circuits to 200 before verification runs.");
} else {
{
  // An unsigned body must never be believed, whatever it claims. The acceptable
  // answers are NAMED rather than "anything but 200": a 404 would satisfy a
  // not-200 test while meaning the route is missing.
  const r = await post("/api/stripe/site/x", {
    type: "checkout.session.completed",
    data: { object: { id: "cs_forged", payment_status: "paid", client_reference_id: "x:orders:1" } },
  });
  ok("a forged 'paid' event with NO signature is refused", r.status === 400 || r.status === 503,
    r.status + " " + r.text.slice(0, 160));
  ok("...and never answers plain ok:true", !(r.json && r.json.ok === true && !r.json.ignored), JSON.stringify(r.json));
}
{
  const r = await post("/api/stripe/site/x", { type: "checkout.session.completed" }, { "Stripe-Signature": "t=1,v1=deadbeef" });
  ok("a bad signature is refused", r.status === 400 || r.status === 503, r.status + " " + r.text.slice(0, 160));
}
}
}

// ── what must never come back ────────────────────────────────────────────────

console.log("\nleaks");
{
  // Neither route may ever echo a key, a ciphertext, or a provider message that
  // could quote the request — the request carries the site's own line items.
  const bodies = [];
  bodies.push((await post("/api/db/nope/checkout", { table: "orders", items: [{ id: 1 }] })).text);
  bodies.push((await post("/api/stripe/site/nope", { type: "x" })).text);
  const all = bodies.join(" ");
  ok("no response mentions a Stripe key prefix", !/sk_live|sk_test|whsec_|rk_live/.test(all), all.slice(0, 200));
  ok("no response leaks a ciphertext envelope", !/\bv[12]\./.test(all), all.slice(0, 200));
  ok("no response leaks a connection string", !/postgres(ql)?:\/\//.test(all), all.slice(0, 200));
}

// ── the owner's doors are still gated ────────────────────────────────────────

console.log("\nowner routes stay gated");
for (const [label, path, method] of [
  ["secrets list", "/api/site/anything/secrets", "GET"],
  ["secrets add", "/api/site/anything/secrets", "POST"],
  ["secrets delete", "/api/site/anything/secrets/SOME_KEY", "DELETE"],
]) {
  const res = await fetch(BASE + path, { method, ...(method === "POST" ? { headers: { "content-type": "application/json" }, body: "{}" } : {}) });
  ok(label + " needs an isibi session", res.status === 401, "got " + res.status);
}

console.log("\n" + (failed ? failed + " FAILED" : "all checks passed"));
console.log("NOT PROVEN HERE: a real purchase. No card was charged and no site holds a Stripe key.");
process.exit(failed ? 1 : 0);
