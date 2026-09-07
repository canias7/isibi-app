// THE CODE, SENT OUT AS IT IS WRITTEN (2026-09-07, owner: "yea lets do it,
// send the code out as it writes").
//
// WHAT THIS IS ABOUT. The build's code step showed a stage name and a clock and
// no code, and the box that was there before showed nothing at all — a display
// wired to an NDJSON stream the site build route has never sent. The generation
// happens inside the container, which streams from the model and awaited the
// whole call before anything left the process.
//
// SIX HOPS NOW CARRY IT, and every one of them is the layer this repository has
// shipped twelve dead features on: the transport's data handler → the joiner's
// partial → gen-code → the container's sender → the Worker's route and store →
// the poll → the browser. A guard that drives the middle and reads none of the
// ends is exactly the shape that let those twelve ship, so the call sites are
// COUNTED here and the walls are DRIVEN.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { readCodeSoFar, unescapeJson, tailOf, codeUpdate, CODE_FIELD, NAME_FIELDS, CODE_TAIL_MAX } from "../builder/gen-code.mjs";
import { streamPartial, joinXaiStream, joinAnthropicStream, PARTIAL_EVERY_MS, BUILDER_CALL_MS, callBuilderModel } from "../builder/build-call.mjs";
import { codeKey, packResume } from "../builder/build-resume.mjs";
import { loadWorker } from "./fixtures/worker-harness.mjs";

const SERVER = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const CHAT = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const POLL = fs.readFileSync(new URL("../public/edit-poll.js", import.meta.url), "utf8");
const PAGEGEN = fs.readFileSync(new URL("../builder/page-gen.mjs", import.meta.url), "utf8");

/** Comments blanked, length preserved — this file's own prose names every
 *  spelling it forbids, which is the recorded trap. */
const bare = (src) => src.replace(/^[ \t]*\/\/.*$/gm, (m) => " ".repeat(m.length));

// A REAL PAGE, and the transcript a provider would send writing it. Nothing
// below hand-types an escaped string: the fixture is JSON.stringify's own
// output, because a hand-typed constant is a second copy of what the wire looks
// like and the two drift (the recorded fixture trap).
const PAGE = 'import { createFileRoute } from "@tanstack/react-router"\n\nexport const Route = createFileRoute("/")({\n  component: Home,\n})\n\nfunction Home() {\n  return <main className="p-8">Crookes Guitar School</main>\n}\n';
const ARGS = JSON.stringify({ pages: [{ path: "index.tsx", source: PAGE }] });

const xaiSse = (args, step = 19, done = false) => {
  let s = "";
  for (let i = 0; i < args.length; i += step) {
    s += "data: " + JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: "write_pages", arguments: args.slice(i, i + step) } }] } }] }) + "\n\n";
  }
  // A FINISHED transcript says so. Without it the joiner correctly calls the
  // wire cut and `readXaiStream` throws — which is the product being right and
  // the fixture being less capable than the thing it stands for, the recorded
  // fixture trap. `done` is opt-in because the PARTIAL cases need a transcript
  // that has NOT finished, which is the whole point of them.
  return done ? s + "data: " + JSON.stringify({ choices: [{ delta: {}, finish_reason: "tool_calls" }] }) + "\n\ndata: [DONE]\n\n" : s;
};
const anthropicSse = (args, step = 19) => {
  let s = 'data: ' + JSON.stringify({ type: "message_start", message: { id: "m", content: [] } }) + "\n\n";
  s += 'data: ' + JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "tool_use", name: "write_pages" } }) + "\n\n";
  for (let i = 0; i < args.length; i += step) {
    s += 'data: ' + JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: args.slice(i, i + step) } }) + "\n\n";
  }
  return s;
};

// ── THE READER ──────────────────────────────────────────────────────────────

test("DRIVEN: a page comes back readable at EVERY point a stream could be cut", () => {
  // The whole risk of this module is that it is handed a string which stops in
  // the middle of a token — mid-escape, mid-key, mid-`\\uXXXX`. So it is driven
  // at every cut point rather than at three chosen ones: a reader that throws
  // or leaks on one byte in four hundred blanks a customer's panel every few
  // seconds, and a sampled test would find that only by luck.
  let seen = 0;
  for (let i = 1; i <= ARGS.length; i++) {
    const r = readCodeSoFar(ARGS.slice(0, i));
    assert.equal(typeof r.code, "string", "cut " + i + " answered no string");
    assert.equal(typeof r.file, "string", "cut " + i + " answered no file");
    // THE ESCAPES ARE THE POINT. A raw `\n` on screen is the JSON leaking
    // through, which is the thing this module exists to stop.
    assert.ok(!/\\n|\\"|\\\\/.test(r.code), "cut " + i + " leaked an escape: " + JSON.stringify(r.code.slice(-30)));
    if (r.code) seen++;
  }
  assert.ok(seen > ARGS.length / 2, "the reader found code at only " + seen + " of " + ARGS.length + " cuts — the observer is barely alive");
  // And the finished document reads back as exactly the page that went in.
  assert.equal(readCodeSoFar(ARGS).code, PAGE, "a complete document did not come back as the page");
  assert.equal(readCodeSoFar(ARGS).file, "index.tsx");
});

test("DRIVEN: the file is named, and a second page renames it before its source arrives", () => {
  const two = JSON.stringify({ pages: [{ path: "index.tsx", source: "A" }, { path: "menu.tsx", source: "B" }] });
  assert.equal(readCodeSoFar(two).file, "menu.tsx");
  // BETWEEN TWO PAGES THE PANEL MUST NOT BLANK. While the model writes
  // `"path":"menu.tsx"` there is no source being written at all; showing the
  // last finished one is what stops a working generation flickering.
  const upToPath = two.slice(0, two.indexOf('"menu.tsx"') + 8);
  const mid = readCodeSoFar(upToPath);
  assert.equal(mid.code, "A", "the panel blanked between two pages");
  assert.match(mid.file, /^menu/, "the file being started was not named: " + mid.file);
});

test("DRIVEN: nothing is coerced, and junk is refused rather than rendered", () => {
  for (const junk of [null, undefined, 7, [], {}, ["{"], NaN]) {
    const r = readCodeSoFar(junk);
    assert.deepEqual(r, { file: "", code: "" }, "junk was read as code: " + JSON.stringify(junk));
  }
  // `String(["a"])` is `"a"` — the recorded coercion, on a value that reaches a
  // screen.
  assert.equal(readCodeSoFar(['{"source":"x"']).code, "");
  // AND THE SHAPE THAT WOULD BE SCANNED RATHER THAN REFUSED, which the
  // one-element array above is not: an ARRAY OF CHARACTERS indexes and lengths
  // exactly like a string, so a door that tests only truthiness walks it
  // happily and puts what it finds on a customer's screen.
  assert.deepEqual(readCodeSoFar(Array.from('{"source":"x')), { file: "", code: "" },
    "an array of characters was scanned as if it were a string");
});

test("DRIVEN: an unfinished escape is dropped, never rendered and never thrown on", () => {
  assert.equal(unescapeJson("ab\\"), "ab", "a lone trailing backslash survived");
  assert.equal(unescapeJson("ab\\u26"), "ab", "half a unicode escape survived");
  assert.equal(unescapeJson("ab\\u0041c"), "abAc");
  assert.equal(unescapeJson('a\\nb\\tc\\"d\\\\e'), 'a\nb\tc"d\\e');
  assert.equal(unescapeJson("a\\qb"), "aqb", "an escape JSON does not define invented a character");
  for (const junk of [null, undefined, 7, []]) assert.equal(unescapeJson(junk), "");
  // The whole point: this never throws where `JSON.parse` would.
  assert.throws(() => JSON.parse('"ab\\"'), "the fixture no longer demonstrates the hazard");
});

test("DRIVEN: the tail is bounded and cut at a line, and a long single line still shows", () => {
  const many = Array.from({ length: 400 }, (_, i) => "line " + i).join("\n");
  const t = tailOf(many, 200);
  assert.ok(t.length <= 200, "the tail is not bounded: " + t.length);
  assert.ok(many.endsWith(t), "the tail is not the END of the code");
  assert.ok(!/^ine|^ne \d/.test(t), "the tail opened mid-token: " + JSON.stringify(t.slice(0, 12)));
  // A file with no newline in the window must not come back empty — a blank
  // panel is worse than a cut.
  const oneLine = "x".repeat(5000);
  assert.equal(tailOf(oneLine, 100).length, 100, "a single long line came back short");
  // AND THE CASE THAT SEPARATES THE TWO HALVES OF THAT RULE — a window whose
  // ONLY newline is its LAST character. "Drop the partial first line" takes
  // everything there, and the panel goes blank on a file the model is actively
  // writing. The no-newline case above cannot show it: both readings agree.
  assert.equal(tailOf("x".repeat(5000) + "\n", 100).length, 100,
    "a window whose only newline is its last character came back empty");
  assert.equal(tailOf("short", 100), "short");
  for (const junk of [null, undefined, 7, []]) assert.equal(tailOf(junk, 100), "");
  // A nonsense cap falls back to the module's own, never to unbounded.
  assert.ok(tailOf(many, -1).length <= CODE_TAIL_MAX);
  assert.ok(tailOf(many, "lots").length <= CODE_TAIL_MAX);
});

test("DRIVEN: the update the container posts is bounded on the way out, and says how much there really is", () => {
  // THE CONTAINER'S SIDE OF THE CAP. The Worker clips again on arrival (it must
  // — a container is a different program), but an unclipped update posted from
  // here is a body over `GEN_CODE_BODY_MAX`, which the door refuses whole: the
  // customer would see NOTHING on a big page, which is exactly the page worth
  // watching.
  const big = Array.from({ length: 900 }, (_, i) => "const line" + i + " = " + i + ";").join("\n");
  const partial = '{"pages":[{"path":"' + "p".repeat(400) + '.tsx","source":"' + big.replace(/\n/g, "\\n") + '"';
  const u = codeUpdate(partial);
  assert.ok(big.length > CODE_TAIL_MAX * 2, "the fixture is not longer than the cap it is testing");
  assert.ok(u.code.length <= CODE_TAIL_MAX, "the update was not clipped: " + u.code.length);
  assert.ok(u.code.length > 100, "the update was clipped to nothing");
  assert.ok(big.endsWith(u.code), "the clip kept the wrong end — a live view shows what was just written");
  // A NAME IS A NAME, not a place to put a kilobyte.
  assert.ok(u.file.length <= 120, "the file name was not clipped: " + u.file.length);
  // AND `chars` IS THE TRUTH ABOUT THE WHOLE THING, not the length of the clip
  // — the sender compares it to decide whether anything is new, so a clipped
  // count would stop sending the moment a page passed the cap.
  assert.equal(u.chars, big.length, "chars reported the clip rather than the code");
  const smaller = codeUpdate(partial, { max: 300 });
  assert.ok(smaller.code.length <= 300, "an asked-for cap was ignored");
});

test("the field names are DERIVED from the tool, never a second copy of it", () => {
  // `write_pages` (page-gen.mjs) is what produces the JSON this reads. Two
  // copies of its field names would drift the first time the tool is edited,
  // and the drift is SILENT: the panel would quietly stop finding the code,
  // which reads exactly like a model that has not started.
  const at = PAGEGEN.indexOf('name: "write_pages"');
  assert.ok(at > 0, "write_pages is gone — rescope this guard");
  const tool = PAGEGEN.slice(at, at + 12000);
  assert.ok(tool.includes(CODE_FIELD + ": {"), "the tool has no `" + CODE_FIELD + "` property — gen-code is reading a field that does not exist");
  for (const n of NAME_FIELDS) {
    assert.ok(tool.includes(n + ": {"), "the tool has no `" + n + "` property — gen-code names a file from a field that does not exist");
  }
  // And the reader really uses them, rather than happening to agree.
  const custom = JSON.stringify({ rows: [{ label: "a.tsx", body: "CODE HERE" }] });
  const r = readCodeSoFar(custom, { codeField: "body", nameFields: ["label"] });
  assert.equal(r.code, "CODE HERE");
  assert.equal(r.file, "a.tsx");
});

// ── THE JOINERS' PARTIAL ────────────────────────────────────────────────────

test("DRIVEN: both providers' joiners answer the partial from their OWN accumulator", () => {
  // NOT A SECOND SSE PARSER, and that is the property. A partial read by
  // different code from the finished answer drifts the first time a provider
  // changes a field, and the drift is silent. So the partial must come back
  // from the same variable the complete path reads — proved by taking the
  // FINISHED transcript's answer and the cut one's partial and showing the cut
  // one is a prefix of what the finished one holds.
  for (const [name, sse, model] of [["xai", xaiSse(ARGS), "grok-4.6"], ["anthropic", anthropicSse(ARGS), "claude-sonnet-5"]]) {
    const cut = sse.slice(0, Math.floor(sse.length * 0.6));
    const partial = streamPartial(cut, model);
    assert.ok(partial.length > 20, name + ": no partial came back");
    assert.ok(ARGS.startsWith(partial), name + ": the partial is not a prefix of the arguments — it is being read from somewhere else");
    // And it turns into real code.
    const u = codeUpdate(partial);
    assert.ok(u.code.length > 10, name + ": the partial did not become code");
    assert.ok(PAGE.startsWith(u.code) || PAGE.includes(u.code), name + ": the code is not part of the page");
    assert.equal(u.file, "index.tsx", name + ": the file was not named");
  }
  // The joiners' own answers still say `complete: false` — the partial is
  // ADDITIVE, and a caller that reads completeness is unaffected.
  assert.equal(joinXaiStream(xaiSse(ARGS).slice(0, 200)).complete, false);
  assert.equal(joinAnthropicStream(anthropicSse(ARGS).slice(0, 300)).complete, false);
});

test("DRIVEN: streamPartial answers nothing rather than throwing, for anything it cannot read", () => {
  for (const junk of [null, undefined, 7, [], "", "not sse at all"]) {
    assert.equal(streamPartial(junk, "grok-4.6"), "", "junk was read as a partial: " + JSON.stringify(junk));
  }
  // A transcript whose events are unparseable must not take a generation down.
  assert.equal(streamPartial("data: {oh no\n\n", "grok-4.6"), "");
});

// ── THE HOOK ON THE CALL ────────────────────────────────────────────────────

test("DRIVEN: callBuilderModel asks the transport for bytes and hands back code, throttled and fenced", async () => {
  // The hook exists so the container can show the code. Driven with a fake
  // transport, because "does the argument reach the request" is the exact
  // question a source read cannot answer — this repo's own picked-model lesson.
  const sse = xaiSse(ARGS, 7, true);
  const seen = [];
  let sawOnData = false;
  const post = async (url, init) => {
    sawOnData = typeof init.onData === "function";
    // The transport's own contract: the whole answer so far, per chunk.
    let acc = "";
    // A REAL SOCKET'S CHUNKS ARE SEPARATED IN TIME, and the hook is throttled by
    // the clock — so a fixture that delivers everything inside one millisecond
    // measures the throttle rather than the wiring. The await is what makes
    // `Date.now()` move, which is the only thing a network does that matters here.
    for (const part of sse.match(/[\s\S]{1,40}/g)) {
      acc += part;
      await new Promise((r) => setTimeout(r, 1));
      if (init.onData) init.onData(acc);
    }
    return { ok: true, status: 200, text: async () => acc, json: async () => JSON.parse(acc) };
  };
  await callBuilderModel({ xai: "k" }, { model: "grok-4.6", messages: [] }, null, post,
    { stream: true, onPartial: (c) => seen.push(c), partialMs: 1 });
  assert.ok(sawOnData, "the call never asked the transport for bytes — the hook cannot fire");
  assert.ok(seen.length > 2, "the hook fired " + seen.length + " times — nothing was streamed to it");
  // IT GROWS, and the LAST answer is empty on purpose: once the transcript is
  // complete the joiner answers the finished response and no partial at all,
  // which is right — there is nothing partial about a finished generation.
  // Asserting on the last element would be asserting the opposite.
  const grew = seen.filter((c) => c);
  assert.ok(grew.length > 1, "only one non-empty partial arrived — nothing grew");
  assert.ok(grew[grew.length - 1].length > grew[0].length, "the partial never grew");
  for (const c of grew) assert.ok(ARGS.startsWith(c), "the hook was handed something other than the answer so far");

  // A CALLER THAT DOES NOT ASK IS UNCHANGED — no hook, no cost, and the
  // transport is not handed one.
  let asked = true;
  await callBuilderModel({ xai: "k" }, { model: "grok-4.6", messages: [] }, null,
    async (u, init) => { asked = typeof init.onData === "function"; return { ok: true, status: 200, text: async () => sse, json: async () => ({}) }; },
    { stream: true });
  assert.equal(asked, false, "a caller that asked for no partial still had the transport hooked");

  // A HOOK THAT THROWS NEVER COSTS THE BUILD. It runs inside the socket's data
  // handler, where a throw is an unhandled rejection on the connection carrying
  // the generation — which is worth incomparably more than the view of it.
  const out = await callBuilderModel({ xai: "k" }, { model: "grok-4.6", messages: [] }, null, post,
    { stream: true, onPartial: () => { throw new Error("the display exploded"); }, partialMs: 1 });
  assert.ok(out, "a throwing display hook killed the generation");

  // THROTTLED BY THE CLOCK. Re-reading the transcript is O(what has arrived),
  // so per-chunk is quadratic in the length of the longest thing this platform
  // does. With the real cadence a fast stream fires once, not once per chunk.
  const few = [];
  await callBuilderModel({ xai: "k" }, { model: "grok-4.6", messages: [] }, null, post,
    { stream: true, onPartial: (c) => few.push(c) });
  assert.ok(few.length <= 2, "the hook fired " + few.length + " times on a fast stream — it is not throttled");
  assert.ok(PARTIAL_EVERY_MS >= 1000 && PARTIAL_EVERY_MS < BUILDER_CALL_MS,
    "the cadence is not between a sane floor and the call it runs inside: " + PARTIAL_EVERY_MS);
});

test("the transport really offers the hook, and both provider branches hand it over", () => {
  const src = bare(SERVER);
  const at = src.indexOf("function longPost(");
  assert.ok(at > 0, "longPost is gone — rescope this guard");
  const body = src.slice(at, src.indexOf("\n}", at));
  assert.match(body, /init && typeof init\.onData === "function"/, "longPost no longer takes an onData");
  assert.match(body, /res\.on\("data"[\s\S]{0,400}onData\(text\)/, "the data handler no longer calls it with the answer so far");
  assert.match(body, /res\.on\("data"[\s\S]{0,400}try \{[\s\S]{0,120}catch/, "a throwing hook is no longer fenced inside the socket handler");
  // BOTH BRANCHES, COUNTED. One provider wired and the other not is a feature
  // that works on Grok and is dead on Sonnet — invisible until somebody
  // switches the picker.
  const call = fs.readFileSync(new URL("../builder/build-call.mjs", import.meta.url), "utf8");
  assert.equal((bare(call).match(/^\s*onData,$/gm) || []).length, 2,
    "the transport hook is handed to a number of provider branches other than two");
});

// ── THE CONTAINER'S SENDER ──────────────────────────────────────────────────

test("DRIVEN: the container sends only what is new, one at a time, and never at the build's cost", async () => {
  const src = bare(SERVER);
  const cut = (h) => { const a = src.indexOf(h); assert.ok(a > 0, h + " is gone"); return src.slice(a, src.indexOf("\n}", a) + 2); };
  const posts = [];
  let hold = null;                      // armed to make ONE post hang mid-flight
  const fakeFetch = async (url, init) => {
    posts.push({ url, body: JSON.parse(init.body), token: init.headers["x-gen-report"] });
    if (hold) { const gate = hold; hold = null; await new Promise((r) => { gate.release = r; }); }
    return { ok: true };
  };
  const scope = {
    fetch: fakeFetch, BEAT_CALL_MS: 5000, codeUpdate,
    console: { error() {} }, AbortSignal: { timeout: () => undefined },
  };
  const make = new Function(...Object.keys(scope),
    cut("async function sendModelCode(") + "\n" + cut("function codeSender(") + "\nreturn codeSender;")(...Object.values(scope));

  const report = { code: "https://gofarther.dev/api/site/gencode", token: "f".repeat(32), job: "j".repeat(32) };
  const send = make(report, "gen-1");
  assert.equal(typeof send, "function", "no sender was built for a report that named an address");
  // NO ADDRESS, NO SENDER — an older Worker never named one, and the container
  // must then post nowhere rather than at undefined.
  assert.equal(make({ token: "f".repeat(32), job: "j".repeat(32) }, "gen-1"), null);

  send(ARGS.slice(0, 120));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(posts.length, 1, "the first update was not sent");
  assert.equal(posts[0].token, report.token, "the update did not carry the report token");
  assert.equal(posts[0].body.job, report.job);
  assert.equal(posts[0].body.gen, "gen-1", "the update did not name its generation — it cannot bind");
  assert.ok(posts[0].body.code.length > 0 && !/\\n/.test(posts[0].body.code), "the update carried escaped JSON rather than code");

  // NOTHING NEW, NOTHING SENT. A model that has gone quiet must produce no
  // calls at all — a plain timer would re-send the same kilobytes for the
  // length of a pause.
  send(ARGS.slice(0, 120));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(posts.length, 1, "an unchanged update was sent again");

  // Junk never reaches the wire.
  for (const junk of [null, undefined, 7, []]) send(junk);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(posts.length, 1, "junk was posted");

  // ONE AT A TIME, AND THAT IS NOT POLITENESS. Two posts in flight together
  // land in whatever order the network gives them, so a customer watching the
  // code being written would see it go BACKWARDS — the older tail arriving
  // after the newer one and overwriting it in R2. The container's own latch is
  // the only thing that orders them: nothing else on this path does.
  const gate = { release: null };
  hold = gate;
  send(ARGS.slice(0, 200));                       // this one hangs in the fetch
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(posts.length, 2, "the second update never went out at all");
  send(ARGS.slice(0, 260));                       // arrives while the first is in flight
  send(ARGS.slice(0, 320));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(posts.length, 2, "an update was posted while another was still in flight");
  gate.release();
  await new Promise((r) => setTimeout(r, 0));
  // AND THE LATCH RELEASES — a sender that stayed busy for ever would show the
  // first few seconds of a page and then freeze, which looks exactly like a
  // model that stopped.
  send(ARGS.slice(0, 380));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(posts.length, 3, "the sender never sent again after its first post settled");
  assert.ok(posts[2].body.chars > posts[1].body.chars, "the code went backwards");
});

test("the container asks for the partial only when it has somewhere to send it, and the wiring is COUNTED", () => {
  const src = bare(SERVER);
  // THE HOP THAT WOULD LEAVE EVERYTHING ELSE PERFECT AND THE SCREEN DEAD.
  assert.match(src, /const code = codeSender\(report, id\);/, "the generation no longer builds a sender");
  // NOT `[^)]*` BETWEEN THEM: the argument list contains `keysFrom(BUILD_KEYS)`,
  // so a flat scan stops at that `)` and reports the wiring gone — the recorded
  // depth trap, met inside a guard written to catch a wiring bug.
  const gen = src.slice(src.indexOf("const code = codeSender(report, id);"));
  const upToCall = gen.slice(0, gen.indexOf("));") + 3);
  assert.match(upToCall, /callBuilderModel\(/, "the sender is built and no model call follows it");
  assert.match(upToCall, /code \? \{ stream: true, onPartial: code \} : \{ stream: true \}/,
    "the generation call no longer hands the sender to the model call");
  assert.equal((src.match(/codeSender\(/g) || []).length, 2, "the sender is built somewhere new, or nowhere");
  assert.match(src, /import \{ codeUpdate \} from "\.\/gen-code\.mjs"/, "the container no longer imports the reader");
});

test("the image carries the new module — the container imports it", () => {
  // The recorded trap: a module written dependency-free FOR the container,
  // imported by it, and left off the Dockerfile's COPY line. The image builds,
  // the service dies at import on the first build after the deploy, and the
  // customer reads it as "our build service was restarting".
  const df = fs.readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
  const walked = df.includes("builder/") || df.includes("worker/");
  assert.ok(walked, "the Dockerfile no longer copies the builder tree — rescope this guard");
  // `test/dockerfile.test.mjs` walks the whole import graph; this asserts the
  // one thing that guard cannot: that gen-code is dependency-free, which is
  // WHY it may be imported there.
  const mod = fs.readFileSync(new URL("../builder/gen-code.mjs", import.meta.url), "utf8");
  assert.equal((bare(mod).match(/^\s*import /gm) || []).length, 0,
    "gen-code gained an import — it is loaded inside the container and must stay dependency-free");
});

// ── THE WORKER ──────────────────────────────────────────────────────────────

test("DRIVEN: the code route exists, and refuses everything that is not this generation", async () => {
  const worker = await loadWorker();
  const post = (headers, body, env = {}) => worker.fetch(new Request("https://gofarther.dev/api/site/gencode", {
    method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body),
  }), env, { waitUntil() {}, passThroughOnException() {} });

  // NO TOKEN IS A 404, not a 401: the route must not tell a stranger it exists.
  let r = await post({}, { job: "j".repeat(32), gen: "g", code: "x" });
  assert.equal(r.status, 404, "the route answered a caller with no report token");
  // A malformed token, same answer, before anything is read.
  r = await post({ "x-gen-report": "nope" }, { job: "j".repeat(32), gen: "g", code: "x" });
  assert.equal(r.status, 404);
  // A well-formed token with no bucket to check it against: still refused.
  r = await post({ "x-gen-report": "a".repeat(32) }, { job: "j".repeat(32), gen: "g", code: "x" });
  assert.equal(r.status, 404, "the route accepted a token it could not bind");

  // AND THE REFUSAL COMES BEFORE THE BODY IS READ, which is the half a status
  // code cannot show: `genBindingFor` refuses a malformed token too, so the
  // door's own check changes no ANSWER — what it changes is whether a stranger
  // can make this isolate read and parse kilobytes first. Driven by watching
  // `text()`, with the bound case asserted beside it so the observer is proved
  // alive rather than passing because nothing was ever read.
  const bucket = { SITES_BUCKET: { async get() { return null; }, async put() {} } };
  const watched = (headers, body) => {
    let read = false;
    const real = new Request("https://gofarther.dev/api/site/gencode", {
      method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body),
    });
    const spy = new Proxy(real, {
      get(t, k) {
        if (k === "text") return (...a) => { read = true; return Request.prototype.text.call(t, ...a); };
        const v = Reflect.get(t, k);
        return typeof v === "function" ? v.bind(t) : v;
      },
    });
    return worker.fetch(spy, bucket, { waitUntil() {}, passThroughOnException() {} }).then((res) => ({ res, read: () => read }));
  };
  const bad = await watched({ "x-gen-report": "nope" }, { job: "j".repeat(32), gen: "g", code: "x" });
  assert.equal(bad.res.status, 404);
  assert.equal(bad.read(), false, "a malformed token had its body read before it was refused");
  const good = await watched({ "x-gen-report": "a".repeat(32) }, { job: "j".repeat(32), gen: "g", code: "x" });
  assert.equal(good.read(), true, "nothing reads the body on this route — the check above proves nothing");
});

test("DRIVEN: a bound container's update is stored, clipped by THIS side, under the job's own key", async () => {
  const worker = await loadWorker();
  const job = "b".repeat(32), token = "c".repeat(32), gen = "gen-7";
  const put = [];
  const env = {
    SITES_BUCKET: {
      async get(key) {
        // The resume record the binding is checked against.
        if (key.endsWith(".resume.json")) {
          // BUILT BY ITS OWN PRODUCER, never typed here: a hand-written record
          // is a second copy of what the real one looks like, and the two drift
          // silently — this one did, on its first run, and read as the route
          // refusing a bound container.
          return { text: async () => JSON.stringify(packResume({ id: job, uid: "u1", report: token, genId: gen, lane: "l", firedAt: Date.now(), design: {} })) };
        }
        return null;
      },
      async put(key, body) { put.push({ key, body: JSON.parse(body) }); },
    },
  };
  const post = (body) => worker.fetch(new Request("https://gofarther.dev/api/site/gencode", {
    method: "POST", headers: { "content-type": "application/json", "x-gen-report": token }, body: JSON.stringify(body),
  }), env, { waitUntil() {}, passThroughOnException() {} });

  const r = await post({ job, gen, code: "const a = 1\n", file: "index.tsx", chars: 12 });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, stored: true });
  assert.equal(put.length, 1, "nothing was stored");
  assert.equal(put[0].key, codeKey(job), "the update was stored somewhere other than the job's own key");
  assert.equal(put[0].body.code, "const a = 1\n");
  assert.equal(put[0].body.file, "index.tsx");

  // ANOTHER GENERATION'S CONTAINER IS REFUSED — the binding, not just the token.
  const other = await post({ job, gen: "gen-9", code: "x" });
  assert.equal(other.status, 404, "a container from another generation wrote this build's code");

  // A BODY OVER THE CAP IS REFUSED, and BOTH ways it can be are asserted —
  // the property is "nothing oversized is ever stored", not one status code.
  //
  // `tooLargeBody` reads `content-length`, which a real container's fetch sets
  // and which a hand-built Request in this test does not: so the declared-size
  // case is 413 at the door, and the undeclared one is refused a step later
  // when the truncating slice leaves JSON that will not parse. Asserting only
  // the first would have missed that the second refuses at all — and it was
  // the second that this fixture actually produced.
  put.length = 0;
  const big = JSON.stringify({ job, gen, code: "x".repeat(CODE_TAIL_MAX * 3) });
  const declared = await worker.fetch(new Request("https://gofarther.dev/api/site/gencode", {
    method: "POST",
    headers: { "content-type": "application/json", "x-gen-report": token, "content-length": String(big.length) },
    body: big,
  }), env, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(declared.status, 413, "an oversized body that DECLARED its size was read rather than refused");
  const undeclared = await post({ job, gen, code: "x".repeat(CODE_TAIL_MAX * 3) });
  assert.ok(undeclared.status >= 400, "an oversized body with no declared size was accepted");
  assert.equal(put.length, 0, "an oversized body was stored");

  // A FULL-SIZE UPDATE — the ordinary case for the page worth watching — GOES
  // THROUGH THE DOOR, with its size DECLARED the way a real container's fetch
  // declares it. The cap is derived from the tail plus an envelope, and a cap
  // at or under the tail refuses every real update while every small fixture
  // above still passes: the failure would be invisible here and total live.
  put.length = 0;
  const full = JSON.stringify({ job, gen, code: "x".repeat(CODE_TAIL_MAX), file: "index.tsx", chars: 99999 });
  const sized = await worker.fetch(new Request("https://gofarther.dev/api/site/gencode", {
    method: "POST",
    headers: { "content-type": "application/json", "x-gen-report": token, "content-length": String(full.length) },
    body: full,
  }), env, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(sized.status, 200, "a full-size update was refused at the door — the cap is under the tail it carries");
  assert.equal(put.length, 1, "a full-size update was not stored");

  // AND UNDER THE CAP, THE CLIP IS STILL THIS SIDE'S — what is stored is what
  // the Worker decided, so a container on any image writes the same size.
  put.length = 0;
  await post({ job, gen, code: "x".repeat(CODE_TAIL_MAX + 500), file: "y".repeat(400) });
  assert.equal(put.length, 1, "an update inside the cap was refused");
  assert.ok(put[0].body.code.length <= CODE_TAIL_MAX, "an over-tail update was stored whole: " + put[0].body.code.length);
  assert.ok(put[0].body.file.length <= 120, "an oversized file name was stored whole");

  // Nothing to show is not an error, and writes nothing.
  put.length = 0;
  const empty = await post({ job, gen, code: "" });
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), { ok: true, stored: false });
  assert.equal(put.length, 0, "an empty update was stored");
});

test("the poll hands the code back, to its OWNER, while a generation is running", () => {
  const src = bare(WORKER);
  const at = src.indexOf('url.pathname.startsWith("/api/site/build/")');
  assert.ok(at > 0, "the build poll is gone — rescope this guard");
  const end = src.indexOf("let out = null;", at);
  assert.ok(end > at, "the pending branch is gone — rescope this guard");
  const pending = src.slice(at, end);

  assert.match(pending, /codeKey\(jid\)/, "the poll no longer reads the code");
  assert.match(pending, /if \(code\) pend\.code = code;/, "the poll reads the code and never puts it on the wire — the trap this whole change is about");
  // THE OWNER CHECK IS THE ONE THAT MATTERS: this is the customer's own site
  // source, and the job id is guessable in a way a uid is not.
  assert.match(pending, /rec\.uid === bu\.id\) \{ mine = true;/, "the code read is no longer gated on the record's owner");
  assert.match(pending, /if \(mine && flight\)/, "the code is read for a caller who is not the owner, or when nothing is generating");
  // A blip must not turn a healthy build into a failure.
  assert.match(pending, /codeKey\(jid\)[\s\S]{0,600}catch \{/, "the code read is no longer fenced");
  assert.match(pending, /tailOf\(c\.code, CODE_TAIL_MAX\)/, "the poll no longer clips what it hands back");
});

test("the fire tells the container where to send the code, beside where to beat", () => {
  const src = bare(WORKER);
  assert.match(src, /beat: `https:\/\/\$\{APP_ZONE\}\/api\/site\/genbeat`[\s\S]{0,200}code: `https:\/\/\$\{APP_ZONE\}\/api\/site\/gencode`/,
    "the fire no longer names the code address — the container has nowhere to send and the panel stays empty");
  // Both live under the SAME `jobId` condition: a build with no row has no
  // binding, so it must be told neither.
  assert.match(src, /\.\.\.\(jobId \? \{ job: jobId, beat:[\s\S]{0,260}code:/,
    "the code address is named outside the job's own condition");
});

test("the code lives under `jobs/`, which is the one prefix that is already swept", () => {
  // Stage 9's retention sweep takes `jobs/` after a week. A new key anywhere
  // else would be a new thing nobody sweeps — which is the exact finding that
  // stage exists for, and this file's own comment says so.
  assert.match(codeKey("d".repeat(32)), /^jobs\//, "the code key left the swept prefix");
  const retention = fs.readFileSync(new URL("../builder/job-retention.mjs", import.meta.url), "utf8");
  assert.match(retention, /jobs\//, "the retention sweep no longer names the prefix — rescope this guard");
  // Minted from an id we minted, never from a caller's path.
  assert.throws(() => codeKey("../../etc"), /refusing to build a key/);
  assert.throws(() => codeKey(""), /refusing to build a key/);
});

// ── THE BROWSER ─────────────────────────────────────────────────────────────

test("DRIVEN: the browser's reader takes a code update, and coerces nothing", () => {
  const req = createRequire(import.meta.url);
  const EditPoll = req("../public/edit-poll.js");
  const p = EditPoll.buildCode;
  assert.deepEqual(p({ code: { code: "import x", file: "index.tsx" } }), { code: "import x", file: "index.tsx" });
  // A missing file is "", never undefined — one shape for the renderer.
  assert.deepEqual(p({ code: { code: "a" } }), { code: "a", file: "" });
  assert.deepEqual(p({ code: { code: "a", file: ["x"] } }), { code: "a", file: "" }, "a non-string file was coerced onto the screen");
  // EVERY REFUSAL, beside the answers above so the observer is provably alive.
  for (const junk of [null, undefined, {}, [], "x", 7, { code: null }, { code: "x" }, { code: [] },
                      { code: { code: "" } }, { code: { code: ["a"] } }, { code: { code: 7 } }]) {
    assert.equal(p(junk), null, "junk was read as code: " + JSON.stringify(junk));
  }
  // A POLL THAT CARRIES NONE IS `null`, NOT `""`. The display has to tell
  // "nothing arrived this time" (keep what is on screen) from "there is no
  // code", and a falsy string collapses those two.
  assert.equal(p({ pending: true, job: "x" }), null);
});

test("THE WIRING: the poll opens the envelope, one setter writes it, and the row draws it", () => {
  const src = bare(CHAT);
  const fn = (h) => { const a = src.indexOf(h); assert.ok(a > 0, h + " is gone"); return src.slice(a, src.indexOf("\n}", a) + 2); };

  // 1. THE POLL HANDS IT OVER. Reading the body and doing nothing with the code
  // is the purest form of the trap this file is about — and it is exactly what
  // the same branch did with `progress` until yesterday.
  const follow = fn("async function followBuildJob(");
  assert.match(follow, /setBuildCode\(origin, EditPoll\.buildCode\(p\)\)/,
    "the poll parses the body and never hands the code to the setter");

  // 2. ONE WRITER, with the phase setter's rules for the phase setter's reasons.
  const set = fn("function setBuildCode(");
  assert.match(set, /siteOpenId !== origin/, "a poll for another workspace now repaints this one");
  assert.match(set, /typeof got\.code !== 'string'/, "the setter no longer refuses a non-string");
  assert.match(set, /siteBuild\.code === got\.code[\s\S]{0,60}return false/, "the setter repaints on every poll, unchanged or not");
  assert.match(set, /paintReactLive\(\)/, "the code changes and nothing repaints");
  assert.equal((src.match(/siteBuild\.code = /g) || []).length, 2,
    "`siteBuild.code` is assigned somewhere new — the stream reader and the setter are the two");

  // 3. THE ROW DRAWS IT, and the empty caret box cannot come back: the body is
  // rendered only when there is something in it.
  const rows = fn("function reactLiveStepsHTML(");
  assert.match(rows, /const codeNow = !wrote && typeof sb\.code === 'string' && sb\.code \? sb\.code : ''/,
    "the code row no longer reads the code");
  assert.match(rows, /open: !!codeNow,\s*\n\s*body: codeNow \? stCodeBody\(codeNow, true\) : ''/,
    "the row opens or draws a body when there is no code — the empty box is back");
});

test("DRIVEN: the code row draws real code, and draws no pane at all without it", () => {
  const src = bare(CHAT);
  const cut = (h) => { const a = src.indexOf(h); return src.slice(a, src.indexOf("\n}", a) + 2); };
  const order = src.slice(src.indexOf("const ST_PHASE_ORDER = "), src.indexOf("];", src.indexOf("const ST_PHASE_ORDER = ")) + 2);
  const ctx = {
    esc: (s) => String(s == null ? "" : s),
    stStepRow: (o) => JSON.stringify({ label: o.label, state: o.state, open: !!o.open, body: o.body || "" }),
    stAgentsBody: () => "", stImgsBody: () => "",
    stCodeBody: (t, cur) => "PRE[" + t + "]" + (cur ? "CUR" : ""),
    ST_PHASE_ORDER: new Function("return " + order.replace(/^const ST_PHASE_ORDER = /, "").replace(/;$/, ""))(),
    stAgo: new Function(cut("function stAgo(") + "\nreturn stAgo;")(),
    siteBuild: null,
  };
  const render = new Function("ctx", "with (ctx) {" + cut("function reactLiveStepsHTML(") + "\n return reactLiveStepsHTML; }")(ctx);
  const draw = (b) => { ctx.siteBuild = b; return render(); };

  const withCode = draw({ rphase: "generating", code: "import { createFileRoute } from 'x'\n" });
  assert.match(withCode, /PRE\[import \{ createFileRoute \} from 'x'/, "the code is not drawn");
  assert.match(withCode, /CUR/, "the caret is gone from a row that IS being written");
  assert.match(withCode, /"open":true/, "the code row did not open");

  // NO CODE, NO PANE — the empty bordered box with one blinking caret is the
  // thing the owner watched for seventeen minutes, and it must be unrenderable.
  const without = draw({ rphase: "generating" });
  assert.ok(!/PRE\[/.test(without), "an empty code pane was drawn");
  assert.match(without, /"open":false/, "the row opened with nothing in it");
  assert.ok(!/CUR/.test(without), "a caret was drawn with no code");

  // AND NOT AFTER THE STEP IS PAST. A finished step showing a live tail would
  // be claiming work that is over.
  const done = draw({ rphase: "compiling", code: "leftover" });
  assert.ok(!/PRE\[/.test(done), "the code pane survived into the compile step");
});
