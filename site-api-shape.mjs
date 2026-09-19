// WHAT A CONNECTION SAYS ABOUT ITSELF, as opposed to what request it makes.
//
// `site-apis.mjs` owns the REQUEST — fill the blanks, call, cache, refuse. This
// module owns the three things a page writer needs and could never discover:
// what the answer LOOKS LIKE, what each parameter IS, and where the key comes
// from. Separate because the readers are separate: two prompt composers and one
// customer sentence, none of which wants the fetch path or the SSRF guard it
// imports.
//
// WHY THE SHAPE IS THE LARGEST OF THE THREE, MEASURED (2026-09-19). The kit's
// hook is `useApi<T = unknown>`, so a page reading a field either leaves `T`
// unstated or invents one. Neither works, and the reason is not what the first
// write-up of this said:
//
//   * A TYPE ANNOTATION CHANGES NOTHING A VISITOR SEES. Two pages differing only
//     in `useApi<Rates>(…)` against `useApi(…)`, built with the template's own
//     esbuild: 408 bytes each, sha256 73a4782b79a186d0, byte-identical.
//     TypeScript is erased; the call that reaches the browser is the same call.
//   * AND AN INVENTED TYPE CANNOT CATCH A WRONG FIELD NAME, because the same
//     guess produced both. `type Rates = {rate: number}` with `q.data?.rate`
//     typechecks CLEAN — tsc --strict exit 0 — and against the answer the
//     service really sends, `{rates:{current:{gbp:0.79}}}`, that read is
//     `undefined` and renders "".
//
// So the failure is the FIELD NAME and the type is what stopped anybody
// noticing. What fixes it is stating the shape, which is what this holds.
//
// A DECLARED SHAPE IS NOT A VERIFIED RESPONSE, and the two are never conflated
// here: everything below establishes that the page was written against a shape
// somebody stated. Whether the service sends it is a different claim, closed by
// a real call and by nothing in this file.

/** Deeper than any answer a page should be reading a field out of. */
export const MAX_SHAPE_DEPTH = 5;
/** Enough for a nested forecast; far short of a whole API's catalogue. */
export const MAX_SHAPE_NODES = 60;
/**
 * The leaf vocabulary, and it is CLOSED on purpose.
 *
 * A sketch is a tree whose leaves name a JSON type, so `{"rates":{"gbp":
 * "number"}}` says the page reads `q.data.rates.gbp` and that it is a number.
 * An open vocabulary would let a model write a VALUE as a leaf (`0.79`), which
 * reads as a sketch and is a sample — and a page written against a sample
 * hardcodes it. `unknown` is the escape hatch for a field whose type the model
 * genuinely does not know; it is a real answer, not a failure.
 */
export const SHAPE_LEAVES = Object.freeze(["string", "number", "boolean", "unknown"]);
/** The most parameters one connection may name — `normalizeApi`'s own cap. */
export const MAX_PARAMS = 8;
/** What a page may pass. Every one of these survives a query string. */
export const PARAM_TYPES = Object.freeze(["string", "number", "boolean"]);
/** One sentence about a parameter, not a paragraph. */
export const MAX_PARAM_NOTE = 160;
/** The service's own name, as an owner would recognise it. */
export const MAX_SERVICE = 80;
/** One sentence about the plan or the free tier. */
export const MAX_CREDENTIAL_NOTE = 200;
/** At most this many key sentences, and this many keyless names, in one reply. */
export const MAX_CREDENTIAL_SAID = 3;

/**
 * A `{{SECRET}}` placeholder — how a declaration says it needs a key.
 *
 * `param.` matches neither pattern's alphabet, so the two cannot collide:
 * secrets are upper-case and parameters are lower-case with a prefix.
 */
export const SECRET_RE = /\{\{\s*([A-Z][A-Z0-9_]{0,60})\s*\}\}/g;

/**
 * Every `{{SECRET}}` THIS declaration needs, so they can be fetched in one go.
 *
 * ⚠ LIVES HERE RATHER THAN BESIDE THE REQUEST PATH, which is where it was until
 * `credentialNote` had to ask it PER CONNECTION. It is a fact about what a
 * connection SAYS, which is this module's subject, and `site-apis.mjs` re-exports
 * it so every caller keeps the name it has always imported. A second copy of the
 * pattern would be how a connection gets told it needs no key while `fill`
 * refuses the call for a missing one.
 */
export function secretsNeeded(api) {
  const found = new Set();
  const scan = (s) => {
    for (const m of String(s || "").matchAll(SECRET_RE)) found.add(m[1]);
  };
  scan(api.url); scan(api.body);
  for (const v of Object.values(api.headers || {})) scan(v);
  return [...found];
}

const KEY_MAX = 64;
const PLAIN_ID = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const PARAM_NAME = /^[a-z][a-z0-9_]{0,40}$/;

const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/**
 * Clean one declared answer sketch.
 *
 * Three answers, and the third is why this is a function rather than a filter:
 * `null` for "nothing was declared" (the ordinary case, and every connection
 * that existed before today), `{ok: true, shape}` for a usable sketch, and
 * `{ok: false, why}` for one that cannot be read. The two callers want
 * different things from that last case — the engine DROPS it so a stored spec
 * with a bad sketch still serves, the addon's cleaner REFUSES the item so the
 * customer hears a sentence — and a boolean cannot carry both.
 *
 * ⚠ THE TOP LEVEL IS AN OBJECT OR A LIST, AND THE TOOL SAYS THE SAME THING.
 * The two disagreed: the tool declared `returns` object-only while this walked
 * a top-level array and a top-level LEAF perfectly happily. `SHAPE_TOP` is the
 * one definition of what may sit at the root and `API_ITEM.returns.type` is
 * derived from it, so neither can be widened without the other. A bare leaf is
 * out on purpose rather than by omission: `returns: "a list of exchange rates"`
 * is what a model writes when it reaches for prose, and a `type` admitting a
 * string is an invitation to write it.
 */
export const SHAPE_TOP = Object.freeze(["object", "array"]);

export function cleanShape(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  let nodes = 0;
  const walk = (v, depth) => {
    if (++nodes > MAX_SHAPE_NODES) return { ok: false, why: "shape-too-big" };
    if (depth > MAX_SHAPE_DEPTH) return { ok: false, why: "shape-too-deep" };
    if (depth === 1 && !(v && typeof v === "object")) return { ok: false, why: "shape-top" };
    if (typeof v === "string") {
      // A LEAF IS A TYPE NAME, NEVER A VALUE. `"0.79"` and `"sunny"` are what a
      // model writes when it reaches for a sample instead of a sketch, and a
      // page written against a sample hardcodes today's answer.
      const t = v.trim().toLowerCase();
      return SHAPE_LEAVES.includes(t) ? { ok: true, shape: t } : { ok: false, why: "shape-leaf" };
    }
    if (Array.isArray(v)) {
      // ONE ELEMENT, which is the whole of what an array sketch says: every
      // entry looks like this. Two different element shapes is ambiguous and a
      // guess here is a page reading the wrong one of them, so it is refused
      // rather than narrowed to the first.
      if (!v.length) return { ok: true, shape: ["unknown"] };
      if (v.length > 1) return { ok: false, why: "shape-array" };
      const inner = walk(v[0], depth + 1);
      return inner.ok ? { ok: true, shape: [inner.shape] } : inner;
    }
    if (v && typeof v === "object") {
      const out = {};
      const keys = Object.keys(v);
      if (!keys.length) return { ok: false, why: "shape-empty" };
      for (const k of keys) {
        // Bounded and printable. The JSON sketch is produced with
        // `JSON.stringify`, which escapes anything, and the TypeScript emitter
        // quotes any key that is not a plain identifier — so the only thing a
        // key has to be is short and not a control character.
        if (typeof k !== "string" || !k || k.length > KEY_MAX) return { ok: false, why: "shape-key" };
        // eslint-disable-next-line no-control-regex
        if (/[\u0000-\u001f\u007f]/.test(k)) return { ok: false, why: "shape-key" };
        const inner = walk(v[k], depth + 1);
        if (!inner.ok) return inner;
        out[k] = inner.shape;
      }
      return { ok: true, shape: out };
    }
    return { ok: false, why: "shape-leaf" };
  };
  return walk(raw, 1);
}

/** The sketch as a page writer reads it — JSON, in declaration order. */
export function shapeJson(shape) {
  return JSON.stringify(shape);
}

/**
 * The sketch as a TypeScript type, so the annotation is not itself a guess.
 *
 * This is the half that makes the shape actionable rather than decorative: the
 * page writer is handed the exact `T` for `useApi<T>` instead of inventing one,
 * and an invented `T` is what makes a wrong field name typecheck clean.
 */
export function typeFromShape(shape) {
  if (typeof shape === "string") return shape;
  if (Array.isArray(shape)) return typeFromShape(shape[0]) + "[]";
  if (shape && typeof shape === "object") {
    const parts = Object.keys(shape).map((k) => {
      const key = PLAIN_ID.test(k) ? k : JSON.stringify(k);
      return key + ": " + typeFromShape(shape[k]);
    });
    return "{ " + parts.join("; ") + " }";
  }
  return "unknown";
}

/**
 * Clean the parameter list, which arrives in TWO shapes and must keep both.
 *
 * Every connection stored before today declares `params` as a plain array of
 * strings, and those sites go on working byte for byte: a string is read as a
 * name with nothing said about it. An object may carry a type, a required flag
 * and a sentence.
 *
 * `names` IS THE STORED LIST AND `info` IS BESIDE IT, never instead of it.
 * `declFingerprint`, `cacheKey` and `takeParams` all iterate `api.params` as
 * names, so changing that shape would change the cache key of every connection
 * on the platform and re-point `takeParams` at objects. The two cannot drift
 * because they come out of one walk — `info` carries one entry per name, in the
 * same order, and a guard asserts it.
 *
 * `info` IS ABSENT UNLESS SOMETHING WAS SAID. A list of bare names would be a
 * second copy of `names` and would put a key on the wire for every connection
 * that ever existed; present-iff-any is what keeps the negative control exact.
 */
export function cleanParams(raw, stored) {
  const names = [];
  const info = [];
  let said = false;
  // ⚠ A STORED DECLARATION SPLITS THE TWO, AND RE-READING IT MUST PUT THEM BACK
  // TOGETHER. `params` is the list of NAMES once a connection is in
  // `_meta.schema`, so a second pass over it alone answers `info: null` and
  // every type, required flag and sentence is gone one hop after being stored.
  // MEASURED end to end before this argument existed: a connection reached the
  // store with its `returns` and its `credential` intact and its `paramInfo`
  // absent, and the page prompt named no parameter at all — the value computed
  // and never forwarded, in the field whose whole job is to say what a blank
  // is. Paired BY NAME, never by position: `normalizeApi` drops a malformed
  // name, which shifts every index behind it.
  const by = new Map();
  for (const s of (Array.isArray(stored) ? stored : [])) {
    if (s && typeof s === "object" && typeof s.name === "string") by.set(s.name.toLowerCase(), s);
  }
  for (const p0 of (Array.isArray(raw) ? raw : [])) {
    const key = String((p0 && typeof p0 === "object" && !Array.isArray(p0) ? p0.name : p0) || "").toLowerCase();
    const p = (typeof p0 === "string" && by.has(key)) ? by.get(key) : p0;
    // NOT TRIMMED, deliberately. `normalizeApi` has lowercased and matched
    // without trimming since it was written, so every connection stored before
    // today normalises to exactly the list it normalised to yesterday — which
    // is what keeps `declFingerprint`, and therefore every cached answer on the
    // platform, where it was. Trimming here is a one-character widening that
    // would re-key a stranger's cache for a name nobody has ever declared.
    const name = String((p && typeof p === "object" && !Array.isArray(p) ? p.name : p) || "").toLowerCase();
    if (!PARAM_NAME.test(name)) continue;
    if (names.includes(name)) continue;
    const row = { name };
    if (p && typeof p === "object" && !Array.isArray(p)) {
      const type = String(p.type || "").toLowerCase().trim();
      if (PARAM_TYPES.includes(type)) { row.type = type; said = true; }
      // REQUIRED IS ONLY EVER `true`, never coerced from a string. A `"false"`
      // read as required turns every call into a 400; a junk value read as
      // required is the same thing. Absent means optional, which is what every
      // parameter declared before today is.
      if (p.required === true) { row.required = true; said = true; }
      const note = str(p.note || p.description, MAX_PARAM_NOTE);
      if (note) { row.note = note; said = true; }
    }
    names.push(name);
    info.push(row);
    if (names.length >= MAX_PARAMS) break;
  }
  return { names, info: said ? info : null };
}

/**
 * Where the key comes from.
 *
 * The platform already tells the owner WHERE TO PUT IT — the reply names the
 * secret and the browser says "under Cloud → Secrets". What nothing anywhere
 * said is which service it belongs to, which page to sign up on, or whether it
 * costs anything, so the owner is handed a bare `RATES_KEY` and left to work
 * out what it is a key for.
 *
 * `url` MUST BE https. This is an address a person is invited to open, and an
 * http one is a link this platform put in front of its own customer.
 */
export function cleanCredential(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return { ok: false, why: "credential-shape" };
  const service = str(raw.service, MAX_SERVICE);
  const url = str(raw.url || raw.signup, 300);
  const note = str(raw.note, MAX_CREDENTIAL_NOTE);
  if (!service && !url && !note) return null;
  if (url && !/^https:\/\/[^\s/]+/i.test(url)) return { ok: false, why: "credential-url" };
  const out = {};
  if (service) out.service = service;
  if (url) out.url = url;
  if (note) out.note = note;
  return { ok: true, credential: out };
}

/** The parameter, as one line a page writer can act on. */
export function paramLine(row) {
  if (!row || !row.name) return "";
  const bits = [];
  if (row.type) bits.push(row.type);
  bits.push(row.required === true ? "REQUIRED" : "optional");
  return row.name + ": " + bits.join(", ") + (row.note ? " — " + row.note : "");
}

/** `useApi<…>("name", { a, b })` — the call, written out. */
export function readHint(api) {
  const t = api && api.returns ? "<" + typeFromShape(api.returns) + ">" : "";
  const ps = (Array.isArray(api && api.params) ? api.params : []).join(", ");
  return "useApi" + t + "(\"" + String((api && api.name) || "") + "\"" + (ps ? ", { " + ps + " }" : "") + ")";
}

/**
 * Everything a page writer needs about ONE connection beyond its name.
 *
 * SHARED BY THE TWO PROMPT COMPOSERS — the page step's catalogue and the addon
 * directive's "the connection this change adds" block — because these are FACTS
 * and a second copy of them is how a page gets told two different shapes. The
 * prose around them stays each composer's own; only the facts are one
 * definition.
 *
 * EMPTY FOR A CONNECTION THAT DECLARED NONE OF IT, which is every connection
 * that existed before today: both composers then print exactly the line they
 * printed before, byte for byte.
 */
export function apiDetailLines(api) {
  const out = [];
  if (!api) return out;
  for (const row of (Array.isArray(api.paramInfo) ? api.paramInfo : [])) {
    const line = paramLine(row);
    if (line) out.push(line);
  }
  if (api.returns) {
    out.push("it answers " + shapeJson(api.returns) + " — read those exact field names, nothing else is there");
    out.push("so the page writes " + readHint(api));
  }
  return out;
}

/**
 * Which required parameters a caller did not supply.
 *
 * ASKED BEFORE THE UPSTREAM CALL, so a page that forgot one costs the owner
 * nothing: without this the request goes out with the blank substituted as an
 * empty string, and plenty of services answer 200 to that with a default or a
 * degraded answer — the page then renders something plausible and wrong, which
 * is the same failure `fill`'s missing-secret refusal exists to prevent.
 *
 * Reads `paramInfo`, so a connection that declared no metadata requires
 * nothing and behaves exactly as it always has.
 */
export function missingRequired(api, params) {
  const out = [];
  for (const row of (Array.isArray(api && api.paramInfo) ? api.paramInfo : [])) {
    if (!row || row.required !== true) continue;
    const v = params && Object.prototype.hasOwnProperty.call(params, row.name) ? params[row.name] : undefined;
    if (v === undefined || v === null || String(v) === "") out.push(row.name);
  }
  return out;
}

/**
 * The sentence the owner reads about where a key comes from.
 *
 * ⚠ ASKED PER CONNECTION, OF THE CONNECTION'S OWN DECLARATION. It took a FLAT
 * list of every secret the whole change needed, and that one list answered two
 * questions it cannot tell apart. Both were reproduced before this was written:
 *
 *   * A KEYLESS CONNECTION ALONE. The list was empty, so the whole function
 *     answered "That connection needs no key, so it is answering already." —
 *     and this platform has not called the service, does not know whether the
 *     url resolves, and has no business saying it is working. A declared
 *     connection is a stored declaration; whether it answers is a different
 *     claim and is closed by a real call.
 *   * A MIXED KEYED AND KEYLESS REQUEST. The list was non-empty because of the
 *     KEYED one, so the loop ran over both and printed "The key for <keyless>
 *     comes from <service>" off credential metadata a model should not have
 *     written — sending the owner to sign up for a key nothing will ever use.
 *
 * `secretsNeeded` reads THIS declaration's own `{{SECRET}}` placeholders, which
 * is the same reader `fill` refuses a missing key with — so what the owner is
 * told and what the request really needs cannot disagree, and misleading
 * metadata on a keyless connection is ignored rather than believed.
 *
 * Composed HERE and printed verbatim by the browser, the way `pictureNote` and
 * `coverNote` already are: a second composer in `chat.js` is how a customer
 * starts being told about keys that were never asked for.
 */
export function credentialNote(apis) {
  const list = (Array.isArray(apis) ? apis : []).filter((a) => a && a.name);
  if (!list.length) return "";
  const said = [];
  const free = [];
  for (const a of list) {
    if (secretsNeeded(a).length) {
      const c = a.credential;
      // A key IS needed and nobody said where it comes from: silent, because
      // the reply already names the secret and says where to paste it.
      if (!c || (!c.service && !c.url)) continue;
      if (said.length >= MAX_CREDENTIAL_SAID) continue;
      const where = c.url ? " at " + c.url : "";
      said.push("The key for " + a.name + " comes from " + (c.service || "the service") + where +
        (c.note ? " (" + c.note + ")" : "") + ".");
    } else if (free.length < MAX_CREDENTIAL_SAID) {
      // ⚠ WHAT IS TRUE IS ABOUT THE OWNER'S OWN WORK, never about the service.
      // "there is nothing to paste" is a fact this platform knows; "it is
      // answering already" was a fact about a third party nobody had called.
      free.push(a.name);
    }
  }
  if (free.length) {
    said.push(free.join(", ") + (free.length === 1 ? " needs" : " need") +
      " no key, so there is nothing to paste for " + (free.length === 1 ? "it" : "them") + ".");
  }
  return said.join(" ");
}
