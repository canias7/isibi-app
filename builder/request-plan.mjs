// WHAT EACH PART OF A REQUEST TOUCHES, WHAT IT WAITS FOR, AND WHAT MAY RUN
// BESIDE IT (2026-10-08, the parallel-tasks batch).
//
// The owner: *"one user message can contain multiple tasks, independent tasks
// run concurrently, and tasks wait only when they need another task's result
// or would conflict with its changes … The model should identify the requested
// tasks, their targets and dependencies using the full message, files and
// earlier answers; code should validate and enforce that plan. Avoid hardcoded
// phrase matching or site-specific task rules."*
//
// ── WHAT THIS MODULE DECIDES (pure; `request.mjs` keeps the record) ─────────
//
//   * TARGETS. The router names, for every part it found, what that part
//     changes (`writes`) and what it only refers to (`reads`), in one small
//     vocabulary of the site's own resources. Code checks each against the
//     site (a page must look like a page path, a table like a name), keeps
//     what reads, and adds what each step is KNOWN to write from the code's
//     own wiring — a menu step writes the menu, a page removal the page and
//     the menu — so a part whose words sound unrelated to another's still
//     conflicts with it when both reach the same shared thing. A part with
//     nothing readable is taken to touch the whole site: never guessed to be
//     independent.
//   * WAITING. A part waits for the parts the model said it needs
//     (`dependsOn`, kept as `needs`), and for a part that CREATES something it
//     refers to — a menu link to a page another part adds — even when the
//     model did not say so, whichever order the words came in.
//   * WHAT RUNS BESIDE WHAT. Writes are applied one at a time (the site's own
//     lock, in the database, allows one job per site), in an order that
//     honours both of the above. Preparation — a part's model calls and any
//     picture it buys, with nothing written to the site — may run beside
//     another part's job and beside other preparations, but never ahead of an
//     earlier part that writes what it touches: prepared against a site about
//     to change under it, it would be thrown away.
//
// Nothing here reads words for meaning: every decision is the model's
// structured answer, the site's own inventory, or the code's own wiring.

/** The resource kinds a target may name. `site` is the whole site — what a part with no readable target is taken to touch. */
export const TARGET_KINDS = Object.freeze(["page", "new-page", "menu", "footer", "header", "theme", "identity", "data", "new-data", "component", "new-component", "images", "pagelist", "site"]);
/** Kinds that name one thing, after a colon. */
const NAMED = new Set(["page", "new-page", "data", "new-data", "component", "new-component"]);
/** What a kind that creates something makes, as the kind that later refers to it. */
const MADE_AS = Object.freeze({ "new-page": "page", "new-data": "data", "new-component": "component" });
const SITE = "site";

const PATH_RE = /^\/[a-z0-9][a-z0-9/_-]{0,80}$|^\/$/;
const NAME_RE = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

/** A page path as the site names it: lower case, one leading slash, no trailing one, no `.tsx`, `index` the home page. */
export function pagePath(v) {
  if (typeof v !== "string") return null;
  let s = v.trim().toLowerCase().replace(/\.tsx$/, "");
  if (!s) return null;
  if (s === "index" || s === "/index") return "/";
  if (!s.startsWith("/")) s = "/" + s;
  if (s.length > 1) s = s.replace(/\/+$/, "");
  return PATH_RE.test(s) ? s : null;
}

/**
 * ONE TARGET READ BACK, or null. `page:/visit`, `new-page:/gallery`, `menu`,
 * `data:loaves` … — a kind from the list, and for a named kind a name that
 * reads as one. Never coerced: a non-string is no target.
 */
export function readTarget(v) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  const at = s.indexOf(":");
  const kind = (at < 0 ? s : s.slice(0, at)).toLowerCase();
  if (!TARGET_KINDS.includes(kind)) return null;
  if (!NAMED.has(kind)) return at < 0 ? kind : null;
  const name = at < 0 ? "" : s.slice(at + 1).trim();
  if (kind === "page" || kind === "new-page") { const p = pagePath(name); return p ? kind + ":" + p : null; }
  return NAME_RE.test(name) ? kind + ":" + name.toLowerCase() : null;
}

/**
 * THE ROUTER'S `targets`, per change number: `{ [change]: { writes, reads } }`
 * holding only what reads. The router numbers its changes as `dependsOn` does
 * (0 the part it answered, 1… each held part in order). A change named twice
 * keeps the union; a malformed entry is skipped, never guessed.
 */
export function readTargets(raw) {
  const out = {};
  if (!Array.isArray(raw)) return out;
  for (const e of raw) {
    if (!e || typeof e !== "object" || Array.isArray(e) || !Number.isInteger(e.change) || e.change < 0) continue;
    const slot = out[e.change] || (out[e.change] = { writes: [], reads: [] });
    for (const k of ["writes", "reads"]) {
      for (const t of Array.isArray(e[k]) ? e[k] : []) {
        const r = readTarget(t);
        if (r && !slot[k].includes(r)) slot[k].push(r);
      }
    }
  }
  return out;
}

/**
 * WHAT A STEP IS KNOWN TO WRITE, from its route — the code's own wiring of
 * what each executor touches, never the words: the menu step writes the menu;
 * a page taken away or renamed is the page and every menu that links it; the
 * logo step the site's identity; the data and rules steps a table. Steps whose
 * reach depends on what the model picks inside them (a look, a text change
 * with no page, an addition) are known only by what the router named, and
 * with nothing named they are the whole site.
 */
export function impliedWrites(route) {
  if (!route || typeof route !== "object") return [];
  if (route.op === "addon" || route.intent === "addon") return [];
  const layer = typeof route.layer === "string" ? route.layer : "";
  const page = pagePath(route.page);
  const out = [];
  if (layer === "nav") out.push("menu");
  else if (layer === "logo") out.push("identity");
  else if (layer === "page" && page && (route.remove === true || (typeof route.rename === "string" && route.rename))) out.push("page:" + page, "menu", "pagelist");
  else if (layer === "picture") out.push("images", ...(page ? ["page:" + page] : []));
  else if ((layer === "text" || layer === "page") && page) out.push("page:" + page);
  else if (layer === "data" || layer === "rules") out.push("data");
  return out;
}

/**
 * WHAT A STEP BUILDS ITS MODEL REQUEST FROM — the code's own wiring of each
 * step's inputs: the text step lists every page's words, the menu step every
 * menu and the page list, the picture step every picture's description, the
 * routing the page list. A preparation made while an earlier part that writes
 * any of that is still to be applied would be asked again by its job (its
 * request would no longer be the one prepared), so it waits — what it may
 * NOT do is be wrong: the job's exact-request check decides that, not this.
 */
export function stepInputs(part) {
  if (!part) return [SITE];
  if (part.phase === "route" || !part.route) return ["pagelist"];
  const layer = typeof part.route.layer === "string" ? part.route.layer : "";
  if (part.route.op === "addon") return [SITE];
  if (layer === "text") return ["pages"];
  if (layer === "nav") return ["menu", "pagelist"];
  if (layer === "picture") return ["images"];
  return [SITE];
}

/** Does a write change what a step reads? */
function feeds(write, input) {
  if (write === SITE || input === SITE) return true;
  const kind = write.includes(":") ? write.slice(0, write.indexOf(":")) : write;
  if (input === "pages") return ["page", "new-page", "component", "new-component", "header", "footer", "menu", "identity"].includes(kind);
  if (input === "pagelist") return kind === "new-page" || kind === "pagelist";
  if (input === "images") return kind === "images" || kind === "new-page";
  if (input === "menu") return kind === "menu" || kind === "header" || kind === "new-page";
  return overlaps(write, input);
}

/** A part's effective targets: what the router named, what its route is known to write, and the whole site when nothing reads. */
export function effectiveTargets(part) {
  const t = part && part.targets && typeof part.targets === "object" ? part.targets : {};
  const writes = new Set(Array.isArray(t.writes) ? t.writes.map(readTarget).filter(Boolean) : []);
  const reads = new Set(Array.isArray(t.reads) ? t.reads.map(readTarget).filter(Boolean) : []);
  for (const w of impliedWrites(part && part.route)) writes.add(w);
  if (!writes.size) writes.add(SITE);
  return { writes: [...writes], reads: [...reads] };
}

/** The thing a target is about, for overlap: `new-page:/x` and `page:/x` are the same page. */
const thingOf = (t) => {
  const at = t.indexOf(":");
  if (at < 0) return t;
  const kind = t.slice(0, at);
  return (MADE_AS[kind] || kind) + t.slice(at);
};
/** Do two targets reach the same thing? `site` reaches everything; `data` every table. */
function overlaps(a, b) {
  if (a === SITE || b === SITE) return true;
  const ta = thingOf(a), tb = thingOf(b);
  if (ta === tb) return true;
  if ((ta === "data" && tb.startsWith("data:")) || (tb === "data" && ta.startsWith("data:"))) return true;
  return false;
}

/**
 * DO TWO PARTS CONFLICT? When either writes what the other writes or refers
 * to. Two conflicting parts are applied one after the other and the later is
 * prepared only once the earlier has been applied, so it plans against what
 * the earlier one left.
 */
export function conflicts(a, b) {
  const A = effectiveTargets(a), B = effectiveTargets(b);
  for (const w of A.writes) for (const x of [...B.writes, ...B.reads]) if (overlaps(w, x)) return true;
  for (const w of B.writes) for (const x of A.reads) if (overlaps(w, x)) return true;
  return false;
}

/**
 * WAITING THE MODEL DID NOT SAY, AND ONLY ONE KIND: a part that refers to
 * something another part CREATES waits for it — a menu link to the page an
 * addition makes, a row for the table it makes — whichever order the words
 * came in. Only creation: referring to something that already exists needs
 * nothing first. Never added where it would make a cycle with what the model
 * said. Returns the pairs added, `[me, it]`, and adds them to `needs`.
 */
export function inferNeeds(parts) {
  const added = [];
  const reaches = (from, to, seen = new Set()) => {
    if (from === to) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    const p = parts[from];
    return !!p && p.needs.some((m) => reaches(m, to, seen));
  };
  for (const me of parts) {
    if (!me || me.status === "refused") continue;
    const { reads } = effectiveTargets(me);
    if (!reads.length) continue;
    for (const it of parts) {
      if (!it || it.n === me.n || it.status === "refused" || me.needs.includes(it.n)) continue;
      const made = effectiveTargets(it).writes.filter((w) => Object.hasOwn(MADE_AS, w.slice(0, w.indexOf(":"))));
      if (!made.some((w) => reads.some((r) => r !== SITE && thingOf(r) === thingOf(w)))) continue;
      if (reaches(it.n, me.n)) continue;
      me.needs.push(it.n);
      added.push([me.n, it.n]);
    }
  }
  return added;
}

/**
 * THE ORDER WRITES ARE APPLIED IN: every part after the parts it needs, and
 * otherwise in the order the message gave them (`at`, then `n`). Parts in a
 * cycle (refused) keep their place and are never run.
 */
export function applyOrder(parts) {
  const placed = [];
  const done = new Set();
  const byPos = [...parts].sort((a, b) => a.at - b.at || a.n - b.n);
  let moved = true;
  while (placed.length < parts.length && moved) {
    moved = false;
    for (const p of byPos) {
      if (done.has(p.n)) continue;
      if (p.needs.every((m) => done.has(m) || !parts[m])) { placed.push(p.n); done.add(p.n); moved = true; break; }
    }
  }
  for (const p of byPos) if (!done.has(p.n)) placed.push(p.n);
  return placed;
}

/**
 * May a part be prepared ahead of its turn? Never ahead of an earlier part in
 * the apply order that has not ended and that writes what its step reads
 * (`stepInputs`), nor — for a step that writes — one it conflicts with:
 * prepared then, its job would only ask again, a call made for nothing.
 */
export function clearToPrepare(parts, n, ended) {
  const order = applyOrder(parts);
  const me = parts[n];
  const inputs = stepInputs(me);
  for (const m of order) {
    if (m === n) return true;
    const q = parts[m];
    if (!q || ended(q)) continue;
    // A ROUTING writes nothing, so only what it reads (the page list) can make
    // it wait; a step that writes waits for any earlier part it conflicts with.
    if (me.phase !== "route" && me.route && conflicts(q, me)) return false;
    if (effectiveTargets(q).writes.some((w) => inputs.some((i) => feeds(w, i)))) return false;
  }
  return true;
}
