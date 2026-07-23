// Batch 225 — PROFANITY FILTER. An admin manages a blocklist of words; anyone checks text against it and
// gets back a clean flag, the matched words, and a masked version. Covers add (bulk + dedup), check (clean
// vs flagged, whole-word match, masking, case-insensitive), list, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 225");
const slug = "b225";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const addWords = (tok, words) => c.post(`/api/db/${slug}/profanity/words`, { words }, tok === null ? {} : { token: tok });
const listWords = (tok) => c.get(`/api/db/${slug}/profanity/words`, { token: tok }).then((r) => r.json);
const delWord = (tok, w) => c.del(`/api/db/${slug}/profanity/words/${w}`, { token: tok });
const check = (text) => c.post(`/api/db/${slug}/profanity/check`, { text }).then((r) => r.json);

// --- Add words (bulk, dedup, case-normalized) ---
let r = (await addWords(A, ["Darn", "heck", "heck", "BLAST"])).json;
t.eq(r.total, 3, "adds 3 distinct words (dedup + lowercased)");
t.eq((await listWords(A)).words.length, 3, "list shows the blocklist");

// --- Check: clean text ---
r = await check("what a lovely day");
t.eq(r.clean, true, "clean text → clean:true");
t.eq(r.matches.length, 0, "…no matches");

// --- Check: flagged + masked + case-insensitive ---
r = await check("oh Darn this HECK of a day");
t.eq(r.clean, false, "flagged text → clean:false");
t.ok(r.matches.includes("darn") && r.matches.includes("heck"), "both bad words matched (case-insensitive)");
t.ok(r.masked.includes("****") && !/darn/i.test(r.masked), "…masked with asterisks");

// --- Whole-word only (no substring false positives) ---
r = await check("I unblasted the heckler");
t.ok(!r.matches.includes("blast"), "'blast' does not match inside 'unblasted'");
t.ok(!r.matches.includes("heck"), "'heck' does not match inside 'heckler'");
t.eq(r.clean, true, "…so the sentence is clean");

// --- Delete a word ---
t.eq((await delWord(A, "heck")).json.removed, "heck", "admin removes a word");
t.eq((await check("what the heck")).matches.length, 0, "'heck' no longer flagged after removal");
t.eq((await check("what the heck")).clean, true, "…so the text reads clean now");
t.eq((await listWords(A)).words.length, 2, "list down to 2");

// --- Validation + authz ---
t.eq((await addWords(A, [])).status, 400, "empty words[] → 400");
t.eq((await c.post(`/api/db/${slug}/profanity/check`, {})).status, 400, "check with no text → 400");
t.eq((await delWord(A, "notthere")).status, 404, "removing a word not in the list → 404");
t.eq((await addWords(B, ["x"])).status, 403, "a member can't add words → 403");
t.eq((await listWords(B)).status ?? 403, 403, "a member can't list the blocklist → 403");
t.eq((await c.get(`/api/db/${slug}/profanity/words`, { token: B })).status, 403, "…confirmed 403");
t.eq((await addWords(null, ["x"])).status, 401, "signed-out add → 401");

t.done(); h.restore();
