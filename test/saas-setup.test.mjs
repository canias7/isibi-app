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
import { execFileSync } from "node:child_process";

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


// --------------------------------------------------------- running the thing
//
// Everything above reads source, which is all that is available for zone
// configuration. These RUN the script against a stubbed Cloudflare API, because
// source-reading could not hold it: a mutation making the entitlement branch
// unreachable survived a test asserting the constant and both messages existed
// — all three still did. Only executing a branch proves it is reachable.

const SCRIPT = new URL("../.github/scripts/saas-setup.mjs", import.meta.url).pathname;
const STUB = new URL("./fixtures/cf-stub.mjs", import.meta.url).href;

/** Run it and return everything it printed, whatever it exits with. */
function run(scenario, args = []) {
  try {
    return execFileSync(process.execPath, ["--import", STUB, SCRIPT, ...args], {
      env: { ...process.env, CLOUDFLARE_API_TOKEN: "stub", CF_STUB: JSON.stringify(scenario) },
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    // A non-zero exit is the NORMAL result when something is outstanding, so the
    // output is the thing under test and the status is not.
    return String(e.stdout || "") + String(e.stderr || "");
  }
}

const READY_ZONE = {
  dns: true, ssl: true, routes: true, fallback: "saas.gofarther.dev",
  record: { id: "r1", type: "AAAA", content: "100::", proxied: true },
  routeList: [{ pattern: "*/*", script: "isibi-app" }],
};

test("a missing ENTITLEMENT is not reported as a missing permission", () => {
  // MEASURED ON THE LIVE ZONE: the custom-hostname endpoints answer 1404 "No
  // quota has been allocated" when Cloudflare for SaaS is off. That is nothing
  // to do with the token, and the first version of this script told the reader
  // to add "SSL and Certificates: Read" — advice that cannot work.
  const out = run({ dns: true, routes: true, ssl: false, sslCode: 1404 });
  assert.match(out, /NOT ENABLED/);
  assert.ok(!/add "Zone → SSL and Certificates/.test(out), "still blaming the token for an entitlement");
  // Cloudflare's own 1404 text points at an Enterprise sales form while custom
  // hostnames are self-serve on Free/Pro/Business with 100 included. Following
  // it is a week spent waiting for a reply that is not needed.
  assert.match(out, /Self-serve on Free\/Pro\/Business/);
  // And the downstream steps must give the real reason, or the report says
  // "cannot read with this token" about a token that is fine.
  assert.match(out, /skip {2}Cloudflare for SaaS is not enabled on this zone/);
});

test("a genuinely missing PERMISSION still names the scope", () => {
  // The other side of the same branch. Without this, "never blame the token"
  // passes by never mentioning the token at all.
  const out = run({ dns: false, ssl: true, routes: true });
  assert.match(out, /MISSING read DNS records/);
  assert.match(out, /add "Zone → DNS: Read/);
  assert.ok(!/NOT ENABLED/.test(out), "a 10000 must not be reported as a missing entitlement");
});

test("A DRY RUN WRITES NOTHING, even with everything outstanding", () => {
  // The property that makes this safe to point at production DNS, asserted by
  // recording every non-GET the script actually made rather than by reading for
  // `if (APPLY)`.
  const out = run({ dns: true, ssl: true, routes: true });
  assert.match(out, /\[stub-writes\] none/, out);
  assert.match(out, /MODE: dry run/);
});

test("--apply writes exactly the two changes, and nothing else", () => {
  const out = run({ dns: true, ssl: true, routes: true }, ["--apply"]);
  const writes = (out.match(/\[stub-writes\] (.*)/) || [])[1] || "";
  assert.match(writes, /POST \/zones\/zone123\/dns_records/, "the originless record");
  assert.match(writes, /PUT \/zones\/zone123\/custom_hostnames\/fallback_origin/, "the fallback origin");
  // No route write, ever — wrangler owns routes and would delete this one.
  assert.ok(!/workers\/routes/.test(writes), "the script must never write a route");
  assert.equal(writes.split(" | ").length, 2, "unexpected extra write: " + writes);
});

test("an already-configured zone is reported ready and left alone", () => {
  const out = run(READY_ZONE, ["--apply"]);
  assert.match(out, /\[stub-writes\] none/, "a configured zone must not be rewritten");
  assert.match(out, /Ready\./);
  assert.ok(!/NOT READY/.test(out));
});

test("it refuses a record it did not create, and writes nothing when it does", () => {
  const out = run({ dns: true, ssl: true, routes: true, record: { id: "r9", type: "A", content: "203.0.113.9", proxied: false } }, ["--apply"]);
  assert.match(out, /REFUSING to touch/);
  assert.match(out, /\[stub-writes\] none/, "it wrote despite refusing");
  // And it must not then set a fallback origin at a name it could not prepare.
  assert.match(out, /not setting it/);
});

test("step 3 changes what it says once its precondition is met", () => {
  // Measured: a `*/*` route is refused on a zone with no Cloudflare for SaaS and
  // the refusal fails the whole deploy. So the instruction has to wait — and a
  // pending step that reads the same before and after its precondition is one
  // nobody acts on at the right moment.
  const before = run({ dns: true, ssl: true, routes: true });
  assert.match(before, /later.*add this line/s);
  assert.match(before, /Do steps 1 and 2 first/);
  const after = run({ ...READY_ZONE, routeList: [] });
  assert.match(after, /TODO NOW add this line/);
  assert.ok(!/Do steps 1 and 2 first/.test(after), "still telling a ready zone to do steps 1 and 2");
});

test("the hostname count comes from the total, not the page", () => {
  // A zone with 300 hostnames reporting the page size claims free headroom that
  // is already spent — the one wrong answer here that costs money.
  assert.match(run({ ...READY_ZONE, hostnames: 142 }), /142 registered — 0 left/);
  assert.match(run({ ...READY_ZONE, hostnames: 7 }), /7 registered — 93 left/);
});
