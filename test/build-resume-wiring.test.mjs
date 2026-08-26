// THE WIRE, WHICH IS THE HALF A MODULE TEST CANNOT SEE.
//
// `build-resume.mjs` is a pure vocabulary — every decision in it is driven with
// literals in `build-resume.test.mjs`, and every one of them can be perfectly
// correct while the Worker never calls it. That is the shape this repo has
// recorded twelve dead features in, and this feature has more places to be cut
// than most: the fire has to reach the route, the route has to store a record
// AND send a message, the consumer has to recognise a second kind of message,
// and the resume has to replay the build without firing again.
//
// COMMENTS ARE BLANKED FIRST, length-preserving. `worker.js` argues every one of
// these decisions at length and therefore spells them, so a scan over the raw
// text matches the EXPLANATION and passes against a wire that is cut. Recorded
// in a lint, a router guard, an absence check, a scope scan and a mutation
// before this one.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { hit } from "./fixtures/worker-harness.mjs";

const RAW = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const CODE = RAW.split("\n")
  .map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l))
  .join("\n");
assert.equal(CODE.length, RAW.length, "the blanker changed the file's length — every offset below would be wrong");

/**
 * The named top-level function, bounded by the NEXT top-level declaration.
 *
 * NOT BY BRACE DEPTH, and the first draft of this file was: `buildAndPublishPages`
 * is ~1,200 lines of template literals, JSON payloads and regexes, so a counter
 * that treats every `{` alike closes hundreds of lines early and the guard then
 * reports the feature missing from a function that carries it. The flat-scan
 * mistake this repo has recorded five times, walked into inside a guard written
 * the same hour. A top-level declaration starts at column 0, which is the one
 * landmark a string cannot fake.
 */
function fn(name) {
  const at = CODE.indexOf(`async function ${name}(`);
  assert.ok(at > 0, `${name} is gone — rescope this guard`);
  const ends = [CODE.indexOf("\nasync function ", at + 10), CODE.indexOf("\nfunction ", at + 10)].filter((i) => i > at);
  const end = ends.length ? Math.min(...ends) : CODE.length;
  const body = CODE.slice(at, end);
  // THE WINDOW'S OWN FLOOR. A terminator that stopped matching would hand back
  // a few characters and every absence check below would pass over nothing.
  assert.ok(body.length > 500, `the window on ${name} is ${body.length} characters — this guard would be vacuous`);
  return body;
}

test("THE BUILD MAY FIRE AND THE RESUME MAY NOT — the one flag that decides", () => {
  // A resume that fired again would start a SECOND generation beside the one its
  // own record exists for: charged, running in the same container, and racing
  // the look that is about to read the first one's answer. Asserted in BOTH
  // directions, because either alone is satisfied by a build that never fires.
  const resume = fn("runResumedSiteBuild");
  assert.match(resume, /canFire:\s*false/,
    "the resume does not switch firing off, so a look could start a second generation");
  assert.doesNotMatch(resume, /canFire:\s*true/, "the resume fires");

  // And the build path does, or the whole feature is off and every build holds
  // a consumer invocation for the full generation exactly as before.
  const decl = CODE.indexOf("buildArgs = {");
  assert.ok(decl > 0, "the build route no longer builds its arguments as an object");
  let d = 0, close = -1;
  for (let j = CODE.indexOf("{", decl); j < CODE.length; j++) {
    if (CODE[j] === "{" || CODE[j] === "[" || CODE[j] === "(") d++;
    else if (CODE[j] === "}" || CODE[j] === "]" || CODE[j] === ")") { d--; if (!d) { close = j; break; } }
  }
  assert.ok(close > decl, "could not read the build's arguments");
  const args = CODE.slice(decl, close);
  // GATED ON A RESUME BEING POSSIBLE, and it was an unconditional `true` for one
  // edit. `enqueueSiteBuild` falls through and runs the build INLINE when the
  // queue is unbound or a store write fails, and that path has no job id — so a
  // fire there starts a generation in a container nobody returns to and answers
  // the customer with a `resuming` stage nothing handles. All three are asserted
  // because each alone leaves a way to fire with nowhere to come back to.
  assert.match(args, /canFire:\s*!!\(/,
    "the build fires unconditionally, so a path with no queue starts a generation nothing can resume");
  const fire = /canFire:\s*!!\(([^)]*)\)/.exec(args);
  assert.ok(fire, "the fire condition is not one this guard can read");
  for (const need of ["jobId", "SITES_BUCKET", "BUILD_QUEUE"]) {
    assert.ok(fire[1].includes(need),
      `the fire does not require ${need}, so a build can fire with nowhere to store or schedule its resume`);
  }
});

test("THE RECORD IS WRITTEN BEFORE THE MESSAGE IS SENT", () => {
  // In the other order a resume can arrive, find no record, read that as a build
  // that already finished, and abandon a generation still running in a container
  // — a build the customer paid the design call for and never gets.
  const put = CODE.indexOf("SITES_BUCKET.put(resumeKey(jobId)");
  const send = CODE.indexOf("BUILD_QUEUE.send(packResumeMessage(jobId)");
  assert.ok(put > 0, "the route no longer stores a resume record");
  assert.ok(send > 0, "the route no longer schedules a resume");
  assert.ok(put < send, "the resume message is sent before the record exists");
});

test("THE FIRED BRANCH RETURNS RATHER THAN FALLING THROUGH TO A PUBLISH", () => {
  // The generation has not happened yet. Falling through would publish the
  // stand-in as a FAILED build, tell the customer their pages did not work, and
  // then have the resume publish the real site underneath that message.
  const at = CODE.indexOf('pages.stage === "resuming"');
  assert.ok(at > 0, "the route no longer recognises a fired generation");
  const send = CODE.indexOf("BUILD_QUEUE.send(packResumeMessage(jobId)", at);
  const ret = CODE.indexOf("return Response.json(", send);
  assert.ok(send > at && ret > send, "the fired branch does not answer the caller");
  // 202, because nothing has published: a client reading `ok: true` stops
  // watching, and a client reading a 200 has no way to tell this from a site
  // that is finished and live.
  assert.match(CODE.slice(ret, ret + 400), /status:\s*202/,
    "a build that has not published yet answers as though it had");
});

test("THE CONSUMER KNOWS BOTH KINDS OF MESSAGE", () => {
  // A resume message on a queue that only reads build messages is a look nobody
  // takes — and every fired build then waits out its deadline with the answer
  // sitting unread in a container.
  assert.match(CODE, /readResumeMessage\(/, "nothing reads a resume message off the queue");
  assert.match(CODE, /runResumedSiteBuild\(/, "nothing runs a resume");
  const read = CODE.indexOf("readResumeMessage(");
  const run = CODE.indexOf("runResumedSiteBuild(", read);
  assert.ok(run > read, "the resume is run without its message being read");
});

test("THE POLL COMES BEFORE THE CLAIM, and its own answer is what decides", () => {
  // Claimed first, the claim cannot know whether this look is about to spend —
  // so marking a terminal one needs a SECOND write, and the gap between those
  // two writes is exactly the window the mark exists to close.
  const resume = fn("runResumedSiteBuild");
  const poll = resume.indexOf("await askContainerResult(");
  const decide = resume.indexOf("resumeDecision(");
  const claim = resume.indexOf("onlyIf: { etagMatches:");
  assert.ok(poll > 0 && decide > 0 && claim > 0, "the resume no longer polls, decides and claims");
  assert.ok(poll < decide, "the resume decides before it has an answer to decide on");
  assert.ok(decide < claim, "the claim is written before the decision it is supposed to record");

  // THE NAME THE POLL WROTE MUST BE THE NAME THE DECISION READS. Order alone is
  // satisfied by a poll whose answer is thrown away — `const poll = null;` beside
  // a second variable holding the real one keeps every index above in the right
  // place and decides on nothing. Found by mutation; the ordering survived it.
  const asg = /const (\w+) = await askContainerResult\(/.exec(resume);
  assert.ok(asg, "the poll's answer is not bound to a name this guard can follow");
  assert.match(resume.slice(decide, decide + 120), new RegExp(`\\{\\s*poll:\\s*${asg[1]}\\b|\\{\\s*${asg[1]}\\s*,`),
    `the decision is not given \`${asg[1]}\`, which is the only thing that asked the container`);
});

test("THE PAID HALF IS MARKED IN THE CLAIM, and a marked record is refused", () => {
  // `max_retries` is 0 and the handler acks everything, so a redelivery is
  // already unlikely — and that is a CONFIG one edit from changing, weighed in
  // its own comment as a money decision rather than a guarantee. This is the
  // guard that does not depend on it.
  const resume = fn("runResumedSiteBuild");
  // THE WHOLE CONDITION, NOT THE CALL SOMEWHERE IN IT. A mutant writing
  // `if (false && alreadyCharged(stored, "pages"))` leaves that call in the file
  // and passed a `match` for it — a presence standing in for a property, the
  // own-goal this repo has recorded most and the one that survived this file's
  // first sweep.
  assert.match(resume, /\n\s*if \(alreadyCharged\(stored, "pages"\)\) \{/,
    "the already-charged check is not the whole condition it gates on — something else can switch it off");
  // AND IT MUST RETURN, or a check that runs and falls through is decoration.
  const gate = resume.indexOf('if (alreadyCharged(stored, "pages")) {');
  assert.match(resume.slice(gate, gate + 400), /\n\s*return;/,
    "the already-charged check does not stop the resume, so a marked record is run anyway");

  // ON THE TERMINAL PATH ONLY. Marking a `wait` would refuse the very next look
  // — the build would stall with its generation finished and unread, which is
  // the feature failing in the one way the customer cannot see.
  //
  // ASSERTED PER BRANCH. This compared the mark's INDEX against the wait test's,
  // which is true of both branches of the same ternary: the mutant that marks a
  // wait survived it. The ternary's two arms are read apart now.
  const tern = /decision\.act === "wait"\s*\?([\s\S]*?):([\s\S]*?);\n/.exec(resume);
  assert.ok(tern, "the claim is no longer a wait/terminal choice this guard can read");
  assert.doesNotMatch(tern[1], /withCharged\(/,
    "a look that is only waiting is marked as having spent — the next look would refuse and the build would stall");
  assert.match(tern[2], /withCharged\(/,
    "the terminal claim does not mark the pages charge, so a redelivery would charge again");

  // AND THE REFUSAL COMES BEFORE THE MONEY. A check after the build is a check
  // that reports a double charge rather than preventing one.
  const build = resume.indexOf("await buildAndPublishPages(");
  assert.ok(gate > 0 && build > gate, "the already-charged check runs after the build it is meant to refuse");
});

test("THE RECORD IS DELETED LAST, after the build rather than before it", () => {
  // Deleted before the work, a redelivery finds nothing, reads it as a resume
  // that already finished, and the build is lost with its generation still
  // running. The delete is the tombstone, so it comes after the outcome exists.
  const resume = fn("runResumedSiteBuild");
  const build = resume.indexOf("await buildAndPublishPages(");
  assert.ok(build > 0, "the resume no longer runs the build");
  const poll = resume.indexOf("await askContainerResult(");
  // EVERY DELETE, NOT THE LAST ONE. This read `lastIndexOf`, so a delete ADDED
  // before the build left the last one where it was and the check passed while
  // the record was already gone — blind rather than red, and found by mutation.
  // Two are legitimate: the already-charged refusal deletes a spent record
  // before anything else happens, and the terminal path deletes its own after
  // the outcome exists. Anything BETWEEN them loses a build to a redelivery.
  const dels = [...resume.matchAll(/SITES_BUCKET\.delete\(resumeKey\(id\)\)/g)].map((m) => m.index);
  assert.ok(dels.length >= 1, "nothing ever removes a finished resume record");
  for (const at of dels) {
    assert.ok(at < poll || at > build,
      "a resume record is deleted between the claim and the build — a redelivery would find nothing and abandon a running generation");
  }
});

test("THE RESUME REPLAYS THE SAME FUNCTION, never a second copy of the second half", () => {
  // The whole value of the design: the parse, the usage extraction and the
  // pricing all run through the code the synchronous path uses. A resume that
  // re-implemented the second half is a second billing path, and the first sign
  // of it disagreeing would be a wrong invoice.
  const resume = fn("runResumedSiteBuild");
  assert.match(resume, /await buildAndPublishPages\(env,/,
    "the resume no longer runs the build's own second half");
  assert.match(resume, /resumeCall/,
    "the resume does not hand the generator its stored answer, so it would make the call again");
  // AND IT MUST NOT GENERATE ITSELF. A direct call here is a second generation,
  // charged, for an answer already bought.
  assert.doesNotMatch(resume, /generateSitePages\(/,
    "the resume makes its own generation call — the answer it is resuming for was already paid for");
});

test("A BUILD THAT ANSWERED 202 CAN BE ASKED ABOUT LATER", () => {
  // Without this the outcome is unreachable: the POST's own wait reads the 202
  // and DELETES the key, so the real answer lands minutes later where nobody is
  // looking and stays there. The build is not finished as a feature until
  // something can learn what happened.
  assert.match(CODE, /url\.pathname\.startsWith\("\/api\/site\/build\/"\) && request\.method === "GET"/,
    "there is no way to ask about a build that has not answered yet");
  const at = CODE.indexOf('url.pathname.startsWith("/api/site/build/")');
  const block = CODE.slice(at, at + 2200);
  // AUTHENTICATED, like every other route on this surface.
  assert.match(block, /await authUser\(request, env\)/, "the build result route is not behind a sign-in");
  // AND OWNED. A result body carries the site's slug, its cost and its notes.
  assert.match(block, /out\.uid !== bu\.id/, "any signed-in caller can read any build's answer");
  // AN ABSENT OWNER NEVER MATCHES. Every result written before the field
  // existed carries an empty string, and reading absence as a match would hand
  // a stranger the first such answer they asked for.
  assert.match(block, /!out\.uid \|\| out\.uid !== bu\.id/,
    "a result with no recorded owner is not refused, so an old object is readable by anyone");
  // A PENDING BUILD IS NOT AN ERROR, AND AN ERROR IS NOT PENDING — asserted per
  // BRANCH, because the three answers are only useful if a client can tell them
  // apart. This matched `pending: true … 202` anywhere in the block, so the
  // mutant that made a failed R2 READ answer `pending` passed: a client would
  // then poll for ever against a build that is already finished. A presence
  // standing in for a property, in the guard written for the property.
  //
  // AND THE STATUS IS ASSERTED AS A NUMBER, NEVER AS A SPELLING. The first
  // draft pinned `, 503)` — the shape of a `json()` helper this file does not
  // have — so correcting the route to `Response.json(…, { status: 503 })` turned
  // a guard red against a fix. The spelling-pin own-goal, this repo's most
  // repeated; what has to hold is which status the branch answers.
  const missing = block.indexOf("if (!obj)");
  assert.ok(missing > 0, "the route no longer distinguishes a result that is not there yet");
  const pend = block.slice(missing, block.indexOf(";", missing) + 1);
  assert.match(pend, /pending: true/, "a build still being written does not answer as pending");
  assert.match(pend, /\b202\b/, "a build still being written does not answer 202");
  // THE READ THAT FAILED. `catch` is where a bucket blip lands, and it must not
  // wear the same answer — "we could not look" and "it is not finished" want
  // opposite responses from anything polling.
  //
  // SCOPED TO THE RETURN STATEMENT ITSELF, and a byte window either side was
  // wrong on its first run: the pending branch is the very next statement, so a
  // window reaching forward found its `pending: true` and reported a fault in
  // correct code. A false alarm this repo rates worse than the miss — the
  // overlapping-window own-goal, recorded four times before this.
  const blip = block.indexOf("could not read the result");
  assert.ok(blip > 0, "a failed result read no longer says so");
  const stmt = block.slice(block.lastIndexOf("return", blip), block.indexOf(";", blip) + 1);
  assert.ok(stmt.includes("could not read the result"), "could not read the failed-read answer");
  assert.doesNotMatch(stmt, /pending: true/,
    "a failed read answers as pending, so a client polls for ever against a finished build");
  assert.match(stmt, /\b503\b/, "a failed read does not answer 503");
});

test("THE RESULT RECORDS WHOSE BUILD IT IS, at every writer", () => {
  // The uid is what the route above authorises against, and it can only come
  // from the writers — so a writer that forgets it produces an answer its own
  // owner is refused. DERIVED over every `packResult({`, because a third writer
  // added later would otherwise be uncovered by a list of the four today.
  const writes = [...CODE.matchAll(/packResult\(\{/g)].map((m) => m.index);
  assert.ok(writes.length >= 3, `expected several result writers; found ${writes.length}`);
  for (const at of writes) {
    let d = 0, end = -1;
    for (let j = CODE.indexOf("{", at); j < CODE.length; j++) {
      if (CODE[j] === "{" || CODE[j] === "[" || CODE[j] === "(") d++;
      else if (CODE[j] === "}" || CODE[j] === "]" || CODE[j] === ")") { d--; if (!d) { end = j; break; } }
    }
    assert.ok(end > at, "a packResult call is not closed — the scan cannot read it");
    assert.match(CODE.slice(at, end), /(^|[\s,{])uid:/,
      "a build result is written with no owner, so the route that reads it later would refuse its own customer");
  }
});

test("THE SENTINEL IS READ BEFORE ANY FAILURE HANDLING", () => {
  // `retryHere` would read a fired generation as a failure that spent nothing
  // and make the call AGAIN in the Worker — a second ten-minute generation
  // running beside the one just started, on the path built to avoid exactly one.
  const build = fn("buildAndPublishPages");
  const fired = build.indexOf("readFired(");
  assert.ok(fired > 0, "the build no longer recognises a fired generation");
  const call = build.indexOf("containerPagesFire(");
  assert.ok(call > 0 && call < fired, "the fire is read for before it can happen");
  // The catch that reads it must return the pending marker rather than rethrow,
  // or the route's own catch turns a fired build into a failed one.
  const after = build.slice(fired, fired + 200);
  assert.match(after, /pending:\s*true/,
    "a fired generation is not turned into a pending result, so the route reports it as a failure");
});

// ── AND THEN THE HALF EVEN A SOURCE-READ CANNOT SEE ─────────────────────────
//
// Every check above is a fact about the TEXT of `worker.js`, and the result
// route shipped with `json({ error: "sign in first" }, 401)` in it — a helper
// that does not exist in that file's scope. `node --check` passes it, esbuild
// bundles it, all 4,252 tests were green, and EVERY call to the route would
// have thrown a 500 before reaching a single one of the branches asserted
// above. The `vidRefN` / `du.id` class, in a route the client and both live
// harnesses depend on.
//
// IT WAS INVISIBLE BECAUSE NOTHING CALLED IT. `client-routes.test.mjs` drives
// only the routes the app actually uses, so the route was unreachable-by-any
// -test until the client learned to follow a 202 — which is the same shape as
// the feature being dead, one layer out. So the branches are DRIVEN here:
// a route with six exits and one driven exit is five untested returns.
const AUTHED = { Authorization: "Bearer some-token" };
const A_JOB = "b".repeat(32);

/** Run one request with GoTrue stubbed to answer with a user. */
async function asUser(uid, run) {
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ id: uid }), {
    status: 200, headers: { "content-type": "application/json" },
  });
  try { return await run(); } finally { globalThis.fetch = real; }
}

/** An R2 stand-in that answers `get` however the case needs. */
const bucketThat = (get) => ({ SITES_BUCKET: { get, delete: async () => {}, put: async () => ({}) } });

test("the result route refuses an unauthenticated caller rather than throwing", async () => {
  const r = await hit(`/api/site/build/${A_JOB}`);
  assert.equal(r.status, 401, "an anonymous caller does not get a clean 401 — the route is unreachable or broken");
});

// THE FIXTURE MUST STILL REACH THE ROUTE, and the first draft did not: `new
// Request(".../api/site/build/../../etc/passwd")` NORMALISES to `/api/etc/passwd`,
// which matches no route at all. So it answered 404 from the bottom of the
// router, `isJobId` was never consulted, and `looked` was false trivially — a
// test passing for the wrong reason, which would have left the mutant that
// deletes the check alive with a green assertion sitting over it. Measured
// before the sweep read it, not after. An encoded traversal survives
// normalisation, so it is the one that actually exercises the check.
for (const [jid, why] of [
  ["not-a-job-id", "a plainly malformed id"],
  ["%2e%2e%2fetc%2fpasswd", "an encoded traversal"],
  ["b".repeat(31), "an id one character short"],
]) {
  test(`${why} is not found, and never reaches the bucket`, async () => {
    let looked = false;
    const path = `/api/site/build/${jid}`;
    assert.ok(new URL(new Request("https://gofarther.dev" + path).url).pathname.startsWith("/api/site/build/"),
      "the fixture normalises away before it reaches the route — it would pass over nothing");
    const r = await asUser("owner-1", () => hit(path, {
      headers: AUTHED, env: bucketThat(async () => { looked = true; return null; }),
    }));
    assert.equal(r.status, 404, `${why} is not refused`);
    assert.equal(looked, false, `${why} still reached the store`);
  });
}

test("a build still being written answers 202 pending, not an error", async () => {
  const r = await asUser("owner-1", () => hit(`/api/site/build/${A_JOB}`, {
    headers: AUTHED, env: bucketThat(async () => null),
  }));
  assert.equal(r.status, 202, "a pending build no longer answers 202 — a client would stop following it");
  assert.equal(r.json && r.json.pending, true, "the pending answer does not say so");
});

test("a read that THREW is 503, never pending", async () => {
  // Reading a blip as `pending` has a client poll for ever against a build that
  // is finished — the one failure this branch exists to keep apart.
  const r = await asUser("owner-1", () => hit(`/api/site/build/${A_JOB}`, {
    headers: AUTHED, env: bucketThat(async () => { throw new Error("r2 down"); }),
  }));
  assert.equal(r.status, 503, "a store blip reads as 'still building'");
  assert.notEqual(r.json && r.json.pending, true, "a store blip is reported as pending");
});

test("the answer reaches its owner, replayed exactly as the POST would have sent it", async () => {
  const body = JSON.stringify({ ok: true, slug: "fold-lane", page: "app" });
  const stored = JSON.stringify({ v: 1, status: 200, type: "application/json", body, uid: "owner-1" });
  const r = await asUser("owner-1", () => hit(`/api/site/build/${A_JOB}`, {
    headers: AUTHED, env: bucketThat(async () => ({ text: async () => stored })),
  }));
  assert.equal(r.status, 200, "a finished build's own status is not replayed");
  assert.equal(r.text, body, "the body is not the POST's own, byte for byte");
});

test("…and NOT anybody else's, nor one stored before results carried an owner", async () => {
  const mk = (uid) => JSON.stringify({ v: 1, status: 200, type: "application/json", body: "{}", uid });
  for (const [uid, why] of [["someone-else", "a stranger is handed another customer's build"],
                            ["", "a result written before the field existed is handed out"]]) {
    const r = await asUser("owner-1", () => hit(`/api/site/build/${A_JOB}`, {
      headers: AUTHED, env: bucketThat(async () => ({ text: async () => mk(uid) })),
    }));
    assert.equal(r.status, 404, why);
  }
});

test("the empty-uid clause is INERT today, and the premise that makes it so is asserted", () => {
  // MEASURED RATHER THAN CLAIMED. The empty-uid case above passes with or
  // WITHOUT `!out.uid ||`, because `bu.id` is always truthy and `"" !== <truthy>`
  // refuses on its own — so driving it proves nothing about that clause, and
  // saying it does would be a presence standing in for a property.
  //
  // WHAT HOLDS IT IS THIS PREMISE, in another function one edit from changing:
  // the day `authUser` stops requiring an id, the clause becomes the difference
  // between refusing an old object and handing it to whoever asks first.
  const auth = fn("authUser");
  assert.match(auth, /return user && user\.id \? user : null/,
    "authUser no longer requires an id, which makes the result route's `!out.uid` clause LIVE — drive it");
  // And the clause is still there, since nothing behavioural can hold it.
  assert.match(CODE, /!out\.uid \|\| out\.uid !== bu\.id/,
    "the empty-uid clause is gone — inert today, and the only thing standing between an old result and a strange caller if authUser ever loosens");
});

// ── AND THE THIRD CONSUMER OF THAT ROUTE: THE CUSTOMER'S OWN BROWSER ────────
//
// A 202 is `r.ok`, carries a `slug` and no `error` — so it satisfies the
// client's success gate exactly, and `d.page` being absent makes `built` TRUE.
// Left alone the browser renders "✅ Built “X”. Tell me what to change." over a
// site whose pages are still being written, and then invites a revise against a
// build that is still running. A success that did not happen, which is worse
// than a failure that did.
const CHAT = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8")
  .split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");

test("THE BROWSER FOLLOWS A BUILD THAT FIRED, rather than reading 202 as done", () => {
  const at = CHAT.indexOf("apiFetch(endpoint,");
  assert.ok(at > 0, "the build POST is gone — rescope this guard");
  const send = CHAT.slice(at, CHAT.indexOf("\n}", at));
  // IT RECOGNISES THE ANSWER. Keyed on the status AND the stage, so an ordinary
  // 2xx cannot be mistaken for one and sent into a poll that never resolves.
  assert.match(send, /r\.status === 202/, "the client no longer notices a build that only started");
  assert.match(send, /stage === 'resuming'/, "the client follows any 202, not the one that means a fired build");
  assert.match(send, /followBuildJob\(/, "a 202 is not followed, so the customer never learns what was built");
  // AND THE ANSWER REPLACES THE 202. Following and then discarding the result
  // is the same bug wearing a poll.
  assert.match(send, /r = done\.r;\s*d = done\.d;/,
    "the followed answer is not adopted, so every branch below still reads the 202");
});

test("…and never claims a build that has not finished", () => {
  const at = CHAT.indexOf("const canned = mode === 'revise'");
  assert.ok(at > 0, "the build reply is gone — rescope this guard");
  const reply = CHAT.slice(at, CHAT.indexOf("siteFinishBuild(", at) + 200);
  // THE SUCCESS SENTENCE IS BEHIND THE FLAG. `built` is true on a 202 (`page`
  // is absent, so it is not 'placeholder'), which is exactly how "✅ Built"
  // came to be said over a site that does not exist yet.
  assert.match(reply, /firedJob\s*\?/, "the reply does not branch on a build that is still being written");
  assert.doesNotMatch(reply.slice(0, reply.indexOf("firedJob")), /siteFinishBuild\(/,
    "the reply is composed before the still-running case is considered");
  // AND THE HONEST ONE IS THE SERVER'S OWN. A second copy here eventually
  // disagrees with the sentence the route composed.
  assert.match(reply, /d\.msg/, "the still-running reply does not use the server's own sentence");
});

test("…while still recording the slug it just claimed", () => {
  // THE GIVE-UP PATH MUST NOT RETURN EARLY. The slug is CLAIMED by this build,
  // so a project that forgets it sends the next message as a fresh first build
  // against a name it already owns — a 409 the customer cannot act on.
  //
  // SEARCHED FROM THE POST, NOT FROM THE TOP OF THE FILE. `followBuildJob` is
  // declared above `reactSend` and has its own `if (r.status === 202)` — so a
  // bare `indexOf` found the FOLLOWER's line, read `continue` as an early
  // return, and reported a fault in correct code. The wrong-occurrence trap,
  // recorded here for `confirmSubmitter` matching its own declaration.
  const post = CHAT.indexOf("apiFetch(endpoint,");
  assert.ok(post > 0, "the build POST is gone — rescope this guard");
  const at = CHAT.indexOf("if (r.status === 202", post);
  assert.ok(at > post, "the 202 branch is gone — rescope this guard");
  const branch = CHAT.slice(at, CHAT.indexOf("scheduleCreditRefresh()", at));
  assert.doesNotMatch(branch, /\breturn\b/,
    "the 202 branch returns early, so a build that fired never records its own slug");
  assert.match(branch, /firedJob = d\.job/, "giving up on the follow is not recorded, so the reply cannot tell the truth");
});

test("the follower asks the route that exists, and gives up rather than polling for ever", () => {
  const at = CHAT.indexOf("async function followBuildJob(");
  assert.ok(at > 0, "the follower is gone");
  const body = CHAT.slice(at, CHAT.indexOf("\n}", at));
  assert.match(body, /'\/api\/site\/build\/'/, "the follower does not ask the build-result route");
  // A PENDING ANSWER IS NOT A FAILURE and a run of unreadable ones is: polling
  // for ever against an answer that will not parse is worse than saying so.
  assert.match(body, /r\.status === 202/, "the follower treats 'still building' as an answer");
  assert.match(body, /Date\.now\(\) < until/, "the follower has no bound, so a tab polls for ever");
});

// ── THE TRACE MUST NOT ANNOUNCE AN ENDING THAT HAS NOT HAPPENED ─────────────
//
// RUN 40 (2026-08-26) IS WHY THIS EXISTS, and it is the one bug that run found.
// Both stage-2 paths closed the trace with a bare `rec.finish()`, which writes
// `rowFor(undefined, { done: true })` — three separate faults from one call:
//
//   1. `done: true` on a build that has just been handed to a container and is
//      still running. The trace exists so a build with NOBODY CONNECTED can
//      narrate itself, which is the whole diagnostic capability runs 38 and 39
//      were lost for want of; on the fired path it narrated an ending.
//   2. `steps: []` — the snapshot is dropped, so every mark is thrown away.
//      On the fire that is the whole prologue including the `fired` mark
//      written one line above; on the RESUME it is generation, images, compile,
//      container and publish — the trace destroyed at the moment it is worth
//      reading.
//   3. The row is upserted per SLUG and a bare finish names neither `ok` nor
//      `page`, so an omitted column KEEPS THE PREVIOUS BUILD'S VALUE. Measured
//      live on `northgroup-5`: `ok: false, page: "placeholder"` were run 39's,
//      a day old, sitting in a row whose `done` and `total_ms` were run 40's.
//      One row, two builds' facts.
//
// `build-as-owner` read that row, believed `done: true`, and stopped watching
// after a single poll — ~130 credits' worth of run measuring nothing. So this
// is asserted as a PROPERTY over every call site rather than at the two known
// today, because a third path added later inherits the same default.
test("EVERY rec.finish CLOSES THE ROW WITH REAL FACTS — never a bare call", () => {
  const calls = [...CODE.matchAll(/rec\.finish\(/g)].map((m) => {
    // The call's own argument list, by depth from the opening paren.
    let d = 0;
    let i = m.index + m[0].length - 1;
    for (; i < CODE.length; i++) {
      if (CODE[i] === "(") d++;
      else if (CODE[i] === ")") { d--; if (d === 0) break; }
    }
    return CODE.slice(m.index, i + 1);
  });
  // THE FLOOR. A scan that stopped matching would report a clean file and every
  // assertion below would pass over nothing — the vacuous-clean shape this repo
  // has shipped once already in a check of exactly this kind.
  assert.ok(calls.length >= 3,
    `expected at least 3 rec.finish call sites (the synchronous build, the fire, the resume), found ${calls.length}`);

  for (const c of calls) {
    const args = c.slice("rec.finish(".length, -1).trim();
    assert.ok(args.length > 0,
      "a bare rec.finish() drops the snapshot AND inherits the previous build of this slug's " +
      "ok/page. Pass the trace snapshot and name the outcome: " + c.slice(0, 60));
    // NAMED, NEVER OMITTED. An absent column is not "unset" — it is whatever
    // the last build of this slug wrote, which is how the stale pair got there.
    assert.match(c, /\bok:/, "rec.finish must state `ok` — an omitted column keeps the previous build's: " + c.slice(0, 60));
    assert.match(c, /\bpage:/, "rec.finish must state `page` — an omitted column keeps the previous build's: " + c.slice(0, 60));
  }
});

test("THE FIRE'S TRACE SAYS done: false — the build is not over, it has moved", () => {
  // The one fact that decides whether anything watching keeps watching. `done`
  // defaults to TRUE inside `finish`, so this has to be stated to be false, and
  // stating it is one word away from being deleted again.
  const at = CODE.indexOf('tr.at("fired"');
  assert.ok(at > 0, "the fired mark is gone — rescope this guard");
  const after = CODE.slice(at, CODE.indexOf("return Response.json(", at));
  assert.ok(after.length > 40, "could not isolate the fire's own finish — this check would be vacuous");
  assert.match(after, /rec\.finish\(/, "the fire no longer flushes its marks, so the prologue is lost when the isolate ends");
  assert.match(after, /done:\s*false/,
    "the fire must record `done: false`. Left at the default, the trace declares a build over that " +
    "is running in a container, and anything watching it — the harness, an operator, a status route " +
    "— reads a live build as a dead one. That is what stopped run 40 after one poll.");
  // AND THE SNAPSHOT, or `at` is null and the row cannot say how far it got.
  assert.match(after, /rec\.finish\(\s*tr\.done\(\)/,
    "the fire must pass the trace snapshot, or every mark including `fired` is discarded");
});

// ── A RECORDER THAT IS NEVER IDENTIFIED IS SILENT ───────────────────────────
//
// RUN 40 COULD NOT BE DIAGNOSED BECAUSE OF THIS, and it is the sharpest kind of
// bug this repo keeps finding: not a wrong answer, but an instrument that
// cannot answer. `makeRecorder` HOLDS its snapshot until it is told which site
// it is recording — `pump()` returns early on `!slug` and so does `finish()` —
// so a recorder that is never identified writes NOTHING, ever. Driven to be
// sure rather than read: un-identified, 0 rows; identified, 1 row.
//
// `runResumedSiteBuild` built its own recorder and never called `identify`, so
// the WHOLE SECOND HALF of every resumed build was unrecordable: no marks, no
// outcome, no timings. Worse than a missing row — it made two separate pieces
// of evidence blind at once, because a resume that gives up publishes the
// stand-in, which is already standing, so the site looks identical too. Every
// terminal outcome was therefore indistinguishable from the resume never being
// delivered, which is precisely the wrong conclusion an hour of watching
// produced. It also made the outcome fix beside it inert.
test("EVERY RECORDER IS IDENTIFIED, or it writes nothing at all", () => {
  const at = [...CODE.matchAll(/makeRecorder\(/g)].map((m) => m.index);
  assert.ok(at.length >= 3,
    `expected at least 3 makeRecorder call sites, found ${at.length} — a scan that stopped ` +
    "matching would report a clean file and every check below would pass over nothing");

  // Each window runs to whichever comes first: the next recorder, or the next
  // top-level declaration. A window that ran past either would let one call
  // site's `identify` vouch for another's.
  const tops = [...CODE.matchAll(/\n(?:async )?function /g)].map((m) => m.index);
  for (const i of at) {
    const nextRec = at.find((j) => j > i);
    const nextTop = tops.find((j) => j > i);
    const end = Math.min(nextRec === undefined ? CODE.length : nextRec,
      nextTop === undefined ? CODE.length : nextTop);
    const body = CODE.slice(i, end);
    // TWO HONEST SHAPES. Either this function names the site itself, or it hands
    // the recorder to `runSiteBuild`, which does. Anything else is silent.
    const own = /\.identify\(/.test(body);
    const handed = /runSiteBuild\(/.test(body);
    assert.ok(own || handed,
      "a recorder is created here and never identified, so it can never write a row: " +
      JSON.stringify(CODE.slice(i, i + 50)));
  }
});

test("makeTrace IS GIVEN A CLOCK, never a slug", () => {
  // `makeTrace(now, onStep)` — the FIRST parameter is the clock. The resume
  // passed `design.slug` into it, a string. Every clock read in trace.mjs is
  // guarded, so it did not throw: it returned 0, and every timing on a resumed
  // build was zero. The slug belongs to the RECORDER, via `identify`.
  const args = [...CODE.matchAll(/makeTrace\(\s*([^,)]*)/g)].map((m) => m[1].trim());
  assert.ok(args.length >= 3, `expected at least 3 makeTrace call sites, found ${args.length}`);
  for (const a of args) {
    assert.equal(a, "undefined",
      `makeTrace's first argument is the clock and must be left to its default; found ${JSON.stringify(a)}`);
  }
});
