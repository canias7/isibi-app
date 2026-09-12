// THE CONTAINER SAYS WHICH IMAGE IT IS RUNNING
// (2026-09-10, owner: "WHY DO THE CONTAINER ALWAYS TAKES 20 MINUTES, GEEZ" →
// "YEA WE NEED TO SEE").
//
// Every deploy that changes an image input was followed by a 15-20 minute hold
// before firing anything that had to run the new code. That number was never
// measured — it came from one observation rounded up to something safe — and it
// could not be checked, because the container had no way to name its own image.
// `/health` reported a hash of ONE template file, which moves when the template
// moves and is identical across every worker-only push.
//
// WHAT EACH CASE IS FOR, and every one is a way this ships looking right:
//
//   * THE CIRCULARITY. The id is hashed from GIT OBJECTS AT HEAD, so stamping
//     the checkout's Dockerfile after computing it cannot move it. If that ever
//     stopped being true the id would change on every deploy, every tag would
//     miss, and every deploy would rebuild both images — slow, and silently so.
//   * THE CONTRACT. The container WRITES a string and the Worker PARSES it.
//     Two halves, and a guard that checks only one of them certifies the layer
//     below the break — this repository's most-recorded failure.
//   * CANNOT-TELL. An image built before the stamp existed, or by hand, says
//     `unstamped`. That MUST read as "no answer", never as a value: this is the
//     instrument a person uses to decide whether to wait or to fire.
//   * THE WIRING. A stamp nothing writes, or a reader nothing calls, is the
//     wiring trap — and it is exactly how the band door shipped unreachable
//     earlier today.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stampImageId, STAMP_MARK, imageId, containerInputs, main } from "../.github/scripts/container-images.mjs";
import { healthImage, HEALTH_LANE, laneName } from "../builder/build-lane.mjs";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));

const WORKER = read("worker.js");
const WCODE = code(WORKER);
const SERVER = read("builder/build-server.mjs");
const SCRIPT = read(".github/scripts/container-images.mjs");

const ID = "d9ee764545e997c0";
const DOCKER = "FROM node:22-slim\nCOPY worker.js /app/\nENV NODE_ENV=production\nCMD [\"node\", \"build-server.mjs\"]\n";

// ─────────────────────────────────────────────────────────────────────────────
// THE STAMP
// ─────────────────────────────────────────────────────────────────────────────

test("the id is written into the image, last, and a second stamp replaces the first", () => {
  const once = stampImageId(DOCKER, ID);
  assert.ok(once.includes(STAMP_MARK), "the stamp carries no marker, so it can never be replaced");
  assert.ok(once.trimEnd().endsWith("ENV IMAGE_ID=" + ID), "the id is not the last line — a layer above it loses its cache");
  assert.ok(once.startsWith(DOCKER.trimEnd()), "the Dockerfile above the stamp was rewritten");
  // IDEMPOTENT. The deploy step can run twice on one checkout (a re-run, a
  // retried build), and a second append would leave two ENV lines — the last
  // winning silently, which is the shape that is right by luck.
  const twice = stampImageId(once, "0123456789abcdef");
  assert.equal(twice.match(/ENV IMAGE_ID=/g).length, 1, "a second stamp appended rather than replaced");
  assert.ok(twice.trimEnd().endsWith("ENV IMAGE_ID=0123456789abcdef"));
  assert.equal(twice.match(new RegExp(STAMP_MARK.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")).length, 1);
  // AND STAMPING WITH THE SAME ID TWICE IS THE SAME FILE, which is what makes
  // a re-run of the deploy step produce the same image content.
  assert.equal(stampImageId(once, ID), once);
});

test("a junk id is refused, and refusing leaves a Dockerfile that still builds", () => {
  // Cannot-tell must never read as a value — and here the failure would be an
  // image claiming an id it does not have, which is worse than no id at all.
  for (const bad of ["", null, undefined, "-", "unstamped", "D9EE764545E997C0", "d9ee764545e997c", "d9ee764545e997c00", ["d9ee764545e997c0"], 7, {}]) {
    const out = stampImageId(DOCKER, bad);
    assert.ok(!out.includes("ENV IMAGE_ID"), `${JSON.stringify(bad)} was stamped as if it were an id`);
    assert.ok(out.includes("CMD"), `${JSON.stringify(bad)} left a Dockerfile with no CMD`);
  }
  // A junk id on an ALREADY stamped file takes the old stamp off rather than
  // leaving a stale one — a stale id is a wrong answer, and this instrument
  // exists to stop wrong answers.
  assert.ok(!stampImageId(stampImageId(DOCKER, ID), "").includes("ENV IMAGE_ID"));
});

test("stamping the checkout cannot move the id, because the id is hashed off HEAD", () => {
  // THE CIRCULARITY, DRIVEN. `containerInputs` takes a `git` function and
  // `imageId` hashes what it answers — never file contents — so the id for a
  // commit is the same before and after the working copy is stamped. If this
  // ever inverted, every deploy would compute a NEW id, every registry ask
  // would miss, and both images would rebuild on every push: slow, and with
  // nothing anywhere saying why.
  const git = (p) => "a".repeat(40 - String(p).length % 8) + "0".repeat(String(p).length % 8);
  const inputs = (text) => containerInputs({ context: ".", dockerfileText: text, hasDockerignore: false, git });
  const before = imageId(inputs(DOCKER));
  const after = imageId(inputs(stampImageId(DOCKER, before)));
  assert.equal(after, before, "stamping the working copy moved the image id — every deploy would rebuild");
  // And the guard's own observer is alive: a real change to a COPY source does
  // move it, so the equality above is not vacuous.
  const other = imageId(containerInputs({ context: ".", dockerfileText: DOCKER.replace("worker.js", "other.js"), hasDockerignore: false, git }));
  assert.notEqual(other, before, "the id does not move when the inputs move — the scan is not alive");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE WIRING
// ─────────────────────────────────────────────────────────────────────────────

test("the deploy stamps the Dockerfile it is about to build, and never one it reuses", async () => {
  // DRIVEN through the real `main` with fakes, because a stamp computed and
  // never written is the wiring trap — the one that shipped the band door
  // unreachable this morning.
  // FORMATTED, because `rewriteImage` matches `"image": "<path>"` with the
  // space JSON documents really carry — a compact fixture would be a fixture in
  // a different shape from reality, which is the recorded trap and which this
  // case hit on its first run.
  const cfg = JSON.stringify({
    name: "isibi-app",
    containers: [{ class_name: "SiteBuildContainer", image: "./Dockerfile" },
                 { class_name: "OtherBuildContainer", image: "./other/Dockerfile" }],
  }, null, 2);
  const run = async (present) => {
    const writes = [];
    // The context is NORMALISED by the script (`./other/Dockerfile` →
    // context `other`), so the fixture is keyed the way the script really
    // asks — a fixture in a different shape from reality is the recorded trap,
    // and this one caught itself on the first run.
    const files = { "wrangler.jsonc": cfg, "./Dockerfile": DOCKER, "other/Dockerfile": DOCKER };
    const out = await main({
      root: ".", accountId: "a".repeat(32),
      git: (p) => "b".repeat(40 - (String(p).length % 7)) + "0".repeat(String(p).length % 7),
      wrangler: { build: () => true },
      tagPresent: async () => ({ present, status: present ? 200 : 404 }),
      log: () => {},
      read: (p) => { if (!(p in files)) throw new Error("no such file " + p); return files[p]; },
      exists: () => false,
      write: (p, t) => { writes.push([p, t]); files[p] = t; },
    });
    return { writes, out };
  };

  const built = await run(false);
  const stamped = built.writes.filter(([p]) => /Dockerfile$/.test(p));
  assert.equal(stamped.length, 2, "a built image's Dockerfile was not stamped");
  // PAIRED BY POSITION, because the loop stamps and builds one container at a
  // time in the config's own order — so image `i`'s Dockerfile is stamp `i`.
  // EACH WITH ITS OWN TAG: the two containers have different inputs and must
  // never be stamped with one another's id, which is what a shared variable
  // hoisted out of the loop would do.
  assert.equal(built.out.images.length, 2);
  // `img.tag` is the BUILD tag, `<name>:<id>` — the id alone is what goes into
  // the image, so it is taken off the end rather than compared whole. (The
  // first draft of this case compared against the whole thing and reported
  // correct code as broken.)
  const idOf = (img) => img.tag.split(":").pop();
  built.out.images.forEach((img, i) => {
    assert.match(idOf(img), /^[a-f0-9]{16}$/, "the build tag does not end in an image id");
    assert.ok(stamped[i][1].trimEnd().endsWith("ENV IMAGE_ID=" + idOf(img)),
      `${stamped[i][0]} was stamped with something that is not its own id`);
  });
  assert.notEqual(idOf(built.out.images[0]), idOf(built.out.images[1]),
    "both containers got one id — the guard cannot see a mix-up");
  // AND THE ID STAMPED IN IS THE ID THE CONFIG REFERENCES — one id, two places,
  // and the whole instrument is worthless if they can differ.
  for (const img of built.out.images) assert.ok(img.ref.endsWith("/" + img.tag), "the config's reference does not name the tag that was built");

  const reused = await run(true);
  assert.equal(reused.writes.filter(([p]) => /Dockerfile$/.test(p)).length, 0,
    "a REUSED image's Dockerfile was stamped — that image already carries the id it was built with, and the write goes nowhere");
  assert.deepEqual(reused.out.images.map((i) => i.action), ["reused", "reused"]);
});

test("the container reports its image, and an unstamped one says so", () => {
  // The writer, read out of the container's own source — one line, and the
  // contract's other half is driven against it below.
  assert.match(SERVER, /res\.end\("ok " \+ TEMPLATE_ID \+ " " \+ \(IMAGE_ID \|\| "unstamped"\)\)/,
    "the container no longer reports its image on /health");
  // The env read is VALIDATED, not trusted: a container started with junk in
  // IMAGE_ID must say `unstamped` rather than repeat the junk.
  const at = SERVER.indexOf("const IMAGE_ID = (() => {");
  assert.ok(at > 0, "IMAGE_ID is gone from the container");
  const end = SERVER.indexOf("})();", at);
  assert.ok(end > at, "IMAGE_ID's block has no end");
  const readImage = new Function("env", SERVER.slice(at, end + 5).replace("process.env.IMAGE_ID", "env.IMAGE_ID") + " return IMAGE_ID;");
  assert.equal(readImage({ IMAGE_ID: ID }), ID);
  for (const bad of [undefined, "", "unstamped", "nope", ID.toUpperCase(), ID + "0"]) {
    assert.equal(readImage({ IMAGE_ID: bad }), "", `the container repeated ${JSON.stringify(bad)} as an image id`);
  }
  // AND IT IS AT MODULE SCOPE, not inside the request handler: an env read per
  // request is a value re-derived on a hot path for no reason, and the whole
  // point is that this is fixed for the life of the process.
  assert.ok(at < SERVER.indexOf("const server = http.createServer("), "IMAGE_ID is read inside the request handler");
});

test("the reader and the writer are two halves of ONE contract", () => {
  // THE CASE THAT MATTERS. `healthImage` parses what `build-server.mjs` emits,
  // and a guard on either half alone certifies the layer below the break. So
  // the writer's own expression is EVALUATED here and its output fed to the
  // real reader — no retyped fixture, which would be a second copy of the
  // contract and would drift the first time either side moved.
  const line = /res\.end\((\"ok \" \+ TEMPLATE_ID \+ \" \" \+ \(IMAGE_ID \|\| \"unstamped\"\))\)/.exec(SERVER);
  assert.ok(line, "the container's /health line cannot be read");
  const emit = new Function("TEMPLATE_ID", "IMAGE_ID", "return " + line[1] + ";");
  assert.equal(healthImage(emit("a1b2c3d4e5f6", ID)), ID, "the reader cannot read what the container writes");
  assert.equal(healthImage(emit("a1b2c3d4e5f6", "")), "", "an unstamped image was read as having an id");
});

test("cannot-tell is never an answer", () => {
  assert.equal(healthImage("ok a1b2c3d4e5f6 " + ID), ID);
  for (const bad of [
    "ok a1b2c3d4e5f6 unstamped",          // an image built by hand
    "ok a1b2c3d4e5f6",                    // an image from before the stamp
    "ok",                                 // the oldest shape there is
    "", null, undefined, 7, {},
    ["ok a1b2c3d4e5f6 " + ID],            // String(["x"]) is "x" — the recorded coercion
    "ok a1b2c3d4e5f6 " + ID.toUpperCase(),
    "ok a1b2c3d4e5f6 " + ID + " extra",
    "no a1b2c3d4e5f6 " + ID,              // not a healthy answer at all
  ]) assert.equal(healthImage(bad), "", `${JSON.stringify(bad)} was read as an image id`);
});

// ─────────────────────────────────────────────────────────────────────────────
// THE ROUTE
// ─────────────────────────────────────────────────────────────────────────────

test("the Worker can ask, on a fixed lane, and answers the id rather than a boolean", () => {
  const at = WCODE.indexOf('url.pathname === "/api/site/build-health"');
  assert.ok(at > 0, "the build-health route is gone");
  const end = WCODE.indexOf('url.pathname === "/api/_hold"', at);
  assert.ok(end > at, "the route's closing landmark is gone — the window would swallow the file");
  const route = WCODE.slice(at, end);

  // ── THE BRANCH IS ALIVE, AND THAT IS EVALUATED RATHER THAN LOCATED ─────────
  //
  // A sweep mutant reducing the route to `if (false && url.pathname === …)`
  // SURVIVED this case's first draft, because every landmark below stays
  // exactly where it was: the route reads perfectly and never runs. That is
  // this repository's own recorded trap — "a position is not a behaviour",
  // `if (false) foo()` leaves `foo(` in the file — and the recorded remedy is
  // to cut the thing out and RUN it. So the route's own condition is walked
  // out by parentheses and DRIVEN: true for its own address and method, false
  // for anything else. A dead branch cannot answer true.
  const ifAt = WCODE.lastIndexOf("if (", at);
  assert.ok(ifAt >= 0 && at - ifAt < 200, "the route's own `if (` is not where this scan expects");
  let depth = 0, close = -1;
  for (let i = ifAt + 3; i < WCODE.length; i++) {
    if (WCODE[i] === "(") depth++;
    else if (WCODE[i] === ")") { depth--; if (depth === 0) { close = i; break; } }
  }
  assert.ok(close > ifAt, "the route's condition is not closed — the walk would run off the file");
  const gate = new Function("url", "request", "return (" + WCODE.slice(ifAt + 4, close) + ");");
  assert.equal(gate({ pathname: "/api/site/build-health" }, { method: "GET" }), true,
    "the route's own condition is false for its own address — the branch is dead and every check below is reading a corpse");
  assert.equal(gate({ pathname: "/api/site/build-health" }, { method: "POST" }), false, "the probe answers a POST");
  assert.equal(gate({ pathname: "/api/site/build-healthy" }, { method: "GET" }), false, "the probe answers a neighbouring path");
  assert.equal(gate({ pathname: "/api/_hold" }, { method: "GET" }), false);

  assert.match(route, /if \(!\(await authUser\(request\)\)\) return UNAUTHED\(\)/, "the probe is open to anybody");
  // A FIXED LANE. A container instance is per site, so a caller-supplied lane
  // is a probe that can start a container per name — the same argument the
  // hold probe next door makes, and it is asked of the shared constant rather
  // than a literal spelled twice.
  assert.match(route, /laneName\(HEALTH_LANE\)/, "the probe lane is not the shared one");
  assert.ok(!/laneName\((["'`]|url\.|slug)/.test(route), "the probe takes a caller-supplied lane");
  // THE ID COMES THROUGH THE READER, never a second regex at the route — two
  // lists of the same thing, with the contract as the subject.
  assert.match(route, /image: healthImage\(body\)/, "the route parses the health body itself");
  // AND THE EVIDENCE RIDES BESIDE THE ANSWER: three states (a real id, an
  // unstamped image, an unreachable container) that need different moves, so a
  // collapsed boolean is the recorded "a failure that cannot name itself".
  assert.match(route, /body,/, "the raw body is not returned beside the verdict");
  assert.match(route, /deploy: deployIdOf\(env\)/, "the answer does not say which deploy is asking");
  assert.match(route, /status: 501/, "a missing binding is not told apart from a container that would not answer");

  assert.match(WCODE, /import \{ laneName, healthImage, HEALTH_LANE \} from "\.\/builder\/build-lane\.mjs"/,
    "worker.js spells the reader instead of importing it");
  assert.equal(laneName(HEALTH_LANE), "build-k-health-probe");
});

test("the image carries the lane module, because worker.js imports it", () => {
  // The container runs the Worker's own module graph as the job runtime, so an
  // import worker.js gained is a name the image's COPY line needs — and a
  // container that dies at import reaches the customer as "our build service
  // was restarting", the sentence that has already hidden two other causes.
  assert.match(read("Dockerfile"), /builder\/build-lane\.mjs/, "the image does not carry builder/build-lane.mjs");
});

test("the repository's Dockerfile carries no stamp, and the script is what writes one", () => {
  // The stamp belongs to a CHECKOUT at deploy time, never to the repository: a
  // committed id would be an input to its own hash, which is the circularity
  // this design exists to avoid, and it would be stale the moment anything
  // else changed.
  assert.ok(!read("Dockerfile").includes("ENV IMAGE_ID"), "an image id is committed into the Dockerfile");
  assert.ok(!read("Dockerfile").includes(STAMP_MARK), "the deploy-time stamp is committed");
  // And the script really is the writer, on the build path.
  const sc = code(SCRIPT);
  assert.match(sc, /writeOut\(`\$\{p\.ctx\}\/Dockerfile`, stampImageId\(readText\(`\$\{p\.ctx\}\/Dockerfile`\), p\.tag\)\)/,
    "the deploy no longer stamps the Dockerfile it is about to build");
  assert.ok(sc.indexOf("stampImageId(readText") < sc.indexOf("wrangler.build(p.ctx, tag)"),
    "the stamp is written after the build, so the image cannot carry it");
});
