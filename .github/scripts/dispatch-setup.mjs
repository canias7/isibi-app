// Is Workers for Platforms usable on this account, and does our namespace exist?
//
// Sites are moving from static files on R2 to a Worker per site, rendered at
// request time — see `builder/lovable/template/src/server.ts` for why. That needs a
// dispatch namespace, which needs the product enabled on the account, which is
// a purchase. This answers all three questions before anything depends on them.
//
// DRY RUN BY DEFAULT. Creating a namespace is cheap and idempotent, but it is
// still a write against a paid product on the live account, so `--apply` has to
// be asked for. Run it once to read the report, then again with apply on.
//
// IT IS ALSO THE DIAGNOSTIC. Cloudflare answers a missing PERMISSION and a
// product that is not enabled with statuses that read alike, and this repo has
// already paid once for reporting the wrong one — telling somebody to add an
// SSL permission that could not possibly have helped. So every probe names the
// specific thing to do about it.
const API = "https://api.cloudflare.com/client/v4";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const NAMESPACE = process.env.DISPATCH_NAMESPACE || "gofarther-sites";
const APPLY = process.argv.includes("--apply");

// Cloudflare's own code for "your account does not have this product", as
// distinct from 10000 which is "your token cannot do this". They arrive with
// similar statuses and need completely different actions — one is a purchase,
// the other is a checkbox on the token.
const NOT_ENTITLED = 1404;
const AUTH_ERROR = 10000;

let failed = false;
const say = (...a) => console.log(...a);
const bad = (...a) => { failed = true; console.log(...a); };

async function cf(path, init = {}) {
  const r = await fetch(API + path, {
    ...init,
    headers: { authorization: "Bearer " + TOKEN, ...(init.headers || {}) },
  });
  let body = null;
  try { body = await r.json(); } catch { /* an HTML error page is not JSON */ }
  const codes = ((body && body.errors) || []).map((e) => e.code);
  const why = ((body && body.errors) || []).map((e) => (e.code ? e.code + ": " : "") + (e.message || "")).join("; ");
  return { status: r.status, ok: r.ok && body && body.success !== false, body, codes, why };
}

async function main() {
  say("# Workers for Platforms — dispatch namespace preflight");
  say(APPLY ? "MODE: apply\n" : "MODE: dry run (pass --apply to create)\n");

  if (!TOKEN) { bad("x  CLOUDFLARE_API_TOKEN is not set — nothing can be checked"); return; }
  if (!ACCOUNT) { bad("x  CLOUDFLARE_ACCOUNT_ID is not set — every call needs it"); return; }
  say("ok token and account id are both present");

  // ── 1. is the product enabled ────────────────────────────────────────────
  //
  // Listing namespaces is the cheapest question that distinguishes all three
  // answers: enabled and empty, not enabled, and a token without the scope.
  const list = await cf(`/accounts/${ACCOUNT}/workers/dispatch/namespaces`);
  if (list.codes.includes(NOT_ENTITLED) || list.status === 404) {
    bad("x  WORKERS FOR PLATFORMS IS NOT ENABLED ON THIS ACCOUNT.");
    say("   This is a purchase, not a permission — no token change will fix it.");
    say("   Cloudflare dashboard → Workers & Pages → Workers for Platforms.");
    say("   Reported:", list.why || ("HTTP " + list.status));
    return;
  }
  if (list.codes.includes(AUTH_ERROR) || list.status === 403 || list.status === 401) {
    bad("x  the token cannot read dispatch namespaces.");
    say("   Add the account permission `Workers Scripts: Edit` to CLOUDFLARE_API_TOKEN.");
    say("   NOTE this is the OTHER failure — the product may well be enabled; the token cannot see it.");
    say("   Reported:", list.why || ("HTTP " + list.status));
    return;
  }
  if (!list.ok) {
    bad("x  could not list dispatch namespaces:", list.why || ("HTTP " + list.status));
    return;
  }

  const names = (list.body.result || []).map((n) => n.namespace_name || n.name).filter(Boolean);
  say("ok Workers for Platforms is enabled");
  say("   namespaces:", names.length ? names.join(", ") : "(none yet)");

  // ── 2. does ours exist ───────────────────────────────────────────────────
  if (names.includes(NAMESPACE)) {
    say(`ok the namespace \`${NAMESPACE}\` already exists — nothing to do`);
  } else if (!APPLY) {
    say(`-  the namespace \`${NAMESPACE}\` does not exist yet. Re-run with apply to create it.`);
  } else {
    const made = await cf(`/accounts/${ACCOUNT}/workers/dispatch/namespaces`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: NAMESPACE }),
    });
    if (made.ok) say(`ok created the namespace \`${NAMESPACE}\``);
    else bad(`x  could not create \`${NAMESPACE}\`:`, made.why || ("HTTP " + made.status));
  }

  // ── 3. what is still to do ───────────────────────────────────────────────
  //
  // Written so it reads differently BEFORE and AFTER its precondition. A
  // pending step whose wording does not change is one nobody acts on at the
  // right moment — the lesson from the `*/*` route in saas-setup, which sat
  // "later" through the exact window it needed doing in.
  say("");
  const haveNs = names.includes(NAMESPACE) || APPLY;
  say(haveNs
    ? "NEXT — the namespace is ready. The platform Worker needs a `dispatch_namespaces` binding\n" +
      "  in wrangler.jsonc pointing at it, and the site zone's request path needs to forward to\n" +
      "  the site's script instead of reading R2. Neither is live yet."
    : "NEXT (later) — once the namespace exists, the platform Worker gets a `dispatch_namespaces`\n" +
      "  binding and the site zone forwards to the script. Do not add the binding before the\n" +
      "  namespace: wrangler fails the whole deploy on a binding that names nothing, which is how\n" +
      "  three merges shipped nothing on 2026-08-07.");

  if (failed) process.exitCode = 1;
}

main().catch((e) => { console.log("x  preflight threw:", String((e && e.message) || e)); process.exitCode = 1; });
