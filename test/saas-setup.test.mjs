// THE THREE THINGS CUSTOM DOMAINS NEED ON THE ZONE, held together.
//
// None of this can be proved by running anything — it is configuration on a
// Cloudflare zone, and the token that could check it lives in GitHub Actions.
// So what is guarded here is the part that CAN rot without anybody noticing:
// four files agreeing on the same three facts, and a setup script that cannot
// quietly become destructive.
//
// The failure this prevents is total and silent. A missing `*/*` route does not
// break a test, a build, a deploy or the platform's own site — it breaks every
// CUSTOMER domain, with a 522 that looks like their DNS being wrong.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

/**
 * Comments BLANKED, never removed — this file's own rule, because an index into
 * the stripped text has to stay valid against the real one. Needed here because
 * the script explains the mistakes it corrects, so a naive search for a wrong
 * value finds the sentence saying it was wrong.
 */
const codeOnly = (src) => src.replace(/^[ \t]*\/\/.*$/gm, (m) => " ".repeat(m.length));
const wrangler = read("wrangler.jsonc");
const script = read(".github/scripts/saas-setup.mjs");
const workflow = read(".github/workflows/saas-setup.yml");
const worker = read("worker.js");

const routes = wrangler.slice(wrangler.indexOf('"routes"'), wrangler.indexOf('"r2_buckets"'));
// The exact line, written once. Both the config and the script's step 3 are
// checked against THIS, so the instruction and the thing it instructs cannot
// drift into disagreement — which for a commented-out line is the whole risk,
// since nothing executes it.
const WILDCARD = '{ "pattern": "*/*", "zone_name": "gofarther.dev" }';

test("the two custom domains are declared, and the wildcard is not INSTEAD of them", () => {
  // A Custom Domain provisions its own certificate and DNS record; the wildcard
  // is in addition. Losing these would take the platform's own site down, which
  // is a much larger failure than the one the wildcard fixes.
  assert.match(routes, /"pattern":\s*"gofarther\.dev",\s*"custom_domain":\s*true/);
  assert.match(routes, /"pattern":\s*"www\.gofarther\.dev",\s*"custom_domain":\s*true/);
});

test("the wildcard route is present as an exact, uncommentable line", () => {
  // MEASURED, NOT CHOSEN: enabled, the deploy failed at
  // `PUT /accounts/…/workers/scripts/isibi-app/routes` — the script and both
  // custom domains deployed and the routes call did not, because the zone has
  // no Cloudflare for SaaS on it yet and a bare `*` hostname matches nothing
  // that can exist there. So it waits, commented, and this asserts it is still
  // WRITTEN OUT correctly — a pending step nobody can find is a pending step
  // that never happens.
  const commented = routes.split("\n").some((l) => /^\s*\/\/\s*/.test(l) && l.replace(/^\s*\/\/\s*/, "").trim() === WILDCARD);
  assert.ok(commented, "the wildcard line is missing from wrangler.jsonc or has been reworded");
  // And that it is genuinely still inactive, or the deploy goes red again.
  const active = routes.split("\n").filter((l) => !l.trim().startsWith("//"));
  assert.ok(!active.some((l) => l.includes('"*/*"')), "the wildcard is ACTIVE — the zone must be set up first");
});

test("the config and the setup script agree on what to uncomment", () => {
  // Two copies of one instruction in two files. Disagreeing, somebody follows
  // the script, pastes something the config does not have, and the deploy fails
  // in the way this whole ordering exists to avoid.
  assert.ok(script.includes(WILDCARD), "saas-setup.mjs no longer prints the exact line to add");
  assert.match(script, /wrangler\.jsonc/);
});

test("the route cannot be created out of band, so nothing may suggest it", () => {
  // Wrangler publishes routes with a PUT whose own source comment reads
  // "PUT will delete previous routes on this script" — so a route added by
  // hand or by the setup script survives exactly until the next deploy, and
  // custom domains would break on a push that changed nothing about them.
  assert.match(script, /wrangler\.jsonc/,
    "the script must point at wrangler.jsonc for the route rather than creating one");
  const routeSection = script.slice(script.indexOf("3. Worker route"));
  assert.ok(!/method:\s*"POST"/.test(routeSection) && !/method:\s*"PUT"/.test(routeSection),
    "the script must only VERIFY the route, never write it");
});

test("the fallback origin is originless, and not merely unroutable-looking", () => {
  // `100::` is the IPv6 discard prefix and is Cloudflare's own documented value
  // here. The first draft was `A 192.0.2.1` — a documentation range, which is
  // not the same promise: nothing must be reachable, because the Worker answers
  // before origin resolution and any address that could one day route is an
  // address traffic could one day arrive at.
  assert.match(script, /type:\s*"AAAA",\s*content:\s*"100::"/);
  const code = codeOnly(script);
  // Asserted on CODE, or the comment explaining why `192.0.2.1` was wrong fails
  // the check that it is not used — which is the check passing for the reason
  // it exists to catch, backwards.
  assert.ok(code.includes('"100::"'), "the blanking ate the value it is meant to guard");
  assert.ok(!/192\.0\.2\.|127\.0\.0\.1|0\.0\.0\.0/.test(code), "no IPv4 placeholder origin in code");
  // PROXIED, or Cloudflare tries to REACH `100::` and every custom domain 522s
  // — the same symptom as the missing route, arriving from the other side.
  //
  // Anchored on the CREATE body and on the repair separately. A bare
  // `/proxied: true/` over the whole file passed while the create was changed
  // to false, because the repair branch a hundred lines down satisfied it: a
  // mutation survived exactly that way and this is the fix.
  assert.match(code, /\{\s*\.\.\.ORIGINLESS,\s*name:\s*ORIGIN,\s*proxied:\s*true,/,
    "the record is not CREATED proxied");
  assert.match(code, /method:\s*"PATCH",\s*body:\s*JSON\.stringify\(\{\s*proxied:\s*true\s*\}\)/,
    "an unproxied record is not REPAIRED to proxied");
});

test("the hostname the script sets is the hostname the Worker hands out", () => {
  // Two copies of one fact in two files. Disagreeing, the panel tells owners to
  // point their CNAME at a name that is not the fallback origin, and every
  // domain waits for DNS forever while looking correctly configured.
  const inWorker = worker.match(/SAAS_FALLBACK_ORIGIN\s*\|\|\s*"([^"]+)"/);
  const inScript = script.match(/SAAS_FALLBACK_ORIGIN\s*\|\|\s*\("([^"]+)"\s*\+\s*ZONE_NAME\)/);
  assert.ok(inWorker, "worker.js no longer defaults SAAS_FALLBACK_ORIGIN");
  assert.ok(inScript, "the script no longer derives the fallback origin");
  assert.equal(inWorker[1], inScript[1] + "gofarther.dev");
});

test("it is a DRY RUN until asked, and the workflow defaults to off", () => {
  // It edits DNS on the live zone. A setup script whose first run is also its
  // only irreversible run is the wrong shape for that.
  assert.match(script, /const APPLY = process\.argv\.includes\("--apply"\)/);
  // Every mutation is gated. Found by looking for the inverse: an unguarded
  // write is what a reviewer cannot see by reading the happy path.
  for (const m of script.matchAll(/method:\s*"(POST|PUT|PATCH|DELETE)"/g)) {
    const before = script.slice(0, m.index);
    const guard = before.lastIndexOf("if (APPLY");
    const blockStart = before.lastIndexOf("\nsay(");
    assert.ok(guard > blockStart, `a ${m[1]} at index ${m.index} is not behind an APPLY guard`);
  }
  assert.match(workflow, /default:\s*false/);
});

test("it refuses to overwrite a record it did not create", () => {
  // If that name already points at something real, changing it is an outage on
  // whatever uses it — and a setup script is the last thing that should cause
  // one. Asserted on the branch, since the safe direction here is inaction.
  assert.match(script, /REFUSING to touch/);
  const refusal = script.slice(script.indexOf("rows.length && !mine"), script.indexOf("} else if (mine && mine.proxied)"));
  assert.ok(!/method:\s*"(POST|PUT|PATCH|DELETE)"/.test(refusal), "the refusal branch must write nothing");
});

test("the fallback origin is not set before the record behind it exists", () => {
  // Pointed at a name with no DNS behind it, Cloudflare ACCEPTS the value and
  // every custom hostname then fails to resolve — a success that produces a
  // broken platform, which is the worst of the three outcomes.
  assert.match(script, /if \(APPLY && !recordReady\)/);
});

test("a missing permission NAMES the scope to add", () => {
  // The whole reason this script exists rather than a runbook: the token is a
  // deploy token, several of these will fail, and Cloudflare answers a missing
  // permission with error 10000 "Authentication error" — indistinguishable from
  // a bad token, and nothing about which scope is short.
  for (const p of ["Zone: Read", "DNS: Read", "SSL and Certificates: Read", "Workers Routes: Read"]) {
    assert.ok(script.includes(p), `no probe names "${p}"`);
  }
  assert.match(script, /add "\$\{permission\}" to the API token/);
  // The code as well as the status, because 403 alone does not distinguish
  // "this token cannot" from "this zone will not".
  assert.match(script, /r\.code \|\| r\.status/);
});

test("the workflow passes --apply only when asked", () => {
  assert.match(workflow, /saas-setup\.mjs \$\{\{ inputs\.apply && '--apply' \|\| '' \}\}/);
  assert.match(workflow, /workflow_dispatch/);
  // Manual only. On a schedule or a push it would edit production DNS on
  // somebody else's commit.
  assert.ok(!/on:\s*\n\s*(push|schedule|workflow_run)/.test(workflow));
});
