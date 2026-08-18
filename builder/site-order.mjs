/**
 * WHAT ORDER A LIST COMES OUT IN — the one thing about a list nothing could change.
 *
 * A generated page reads its rows with `useRows("dishes", { order: "name", dir:
 * "asc" })`, and that argument is the whole answer: the database has no opinion,
 * `defaultSort` is parsed and acted on by nothing, and the owner's Data panel
 * shows rows in whatever order it fetched them. So the order a visitor sees is
 * decided by a string in the page source, written once by the generator.
 *
 * MEASURED IN COMMITTED GENERATOR OUTPUT, which is what makes this more than a
 * convenience: `useRows<Hour>("hours", { order: "day", dir: "asc" })` — a week
 * of opening hours sorted ALPHABETICALLY, so a café's site reads Friday,
 * Monday, Saturday, Sunday, Thursday, Tuesday, Wednesday. This file already
 * records the same failure on a pizzeria's menu (Dessert, Pizza, Starters) and
 * the fix was a rule in the generator's prompt. A rule makes it happen less
 * often; it does nothing for the owner looking at it today.
 *
 * WHAT COULD BE DONE ABOUT IT BEFORE THIS: the `page` layer, which rewrites ONE
 * page from its source. Two problems, and the second is the one that matters —
 * a table is read on several pages (`dishes` on the home page and on the menu
 * page), so changing one leaves the site disagreeing with itself, which
 * `orderingMoved` can report and cannot fix.
 *
 * SO IT IS STRUCTURAL AND SITE-WIDE, like the menu and the header button: find
 * every call for that table, rewrite the two properties, leave everything else
 * in the object alone. No page generation, one recompile.
 *
 * WHAT IT DELIBERATELY IS NOT: an arbitrary sequence. "Put the Fade above the
 * Beard trim" is not a sort at any column — it needs a position stored per row,
 * which is a schema change, a backfill and a page rewrite. This answers "by
 * price, cheapest first", "newest first", "by category", which is what the
 * overwhelming majority of "the order is wrong" asks turn out to mean.
 */

/** `useRows` and `usePublicRows` are the only two ways a page reads a list. */
const ROW_HOOKS = /\buse(Public)?Rows\b/g;

/** Postgres takes one direction or the other and nothing else. */
export const SORT_DIRS = ["asc", "desc"];

/** A site is not unbounded, and this feeds the apply as well as the digest. */
export const MAX_SORT_SLOTS = 400;

/**
 * Every list read on the site, with the order it is read in.
 *
 * REFUSED RATHER THAN GUESSED AT when the options are computed — the reference
 * page writes `usePublicRows("appointments", date ? { date } : undefined)`, and
 * a rewrite there either drops the filter or produces something that does not
 * compile. A refused slot is reported; a mangled one is a site that fails to
 * build.
 */
export function sortSlots(pages) {
  const out = [];
  for (const p of Array.isArray(pages) ? pages : []) {
    if (!p || typeof p.path !== "string" || typeof p.source !== "string") continue;
    const src = p.source;
    // Length-preserving, so every offset below is valid against the REAL source.
    // The template's own prose quotes `useRows(...)` while explaining the API.
    const scan = blankComments(src);

    let m;
    ROW_HOOKS.lastIndex = 0;
    while ((m = ROW_HOOKS.exec(scan))) {
      const open = callOpen(scan, m.index + m[0].length);
      if (open < 0) continue;
      const close = matchParen(scan, open);
      if (close < 0) continue;
      const table = firstStringArg(scan, open + 1, close);
      if (!table) continue;

      const slot = {
        page: p.path,
        hook: m[1] ? "usePublicRows" : "useRows",
        table: table.value,
        // A read a visitor never sees is still a read, so both hooks count.
        publicOnly: !!m[1],
      };
      const opts = secondArg(scan, table.end, close);
      if (opts === null) {
        // The second argument is there and is not a plain object literal.
        slot.computed = true;
        slot.order = "";
        slot.dir = "";
      } else if (!opts) {
        // No second argument at all — there is nowhere to read an order from
        // and the insertion point is the end of the table string.
        slot.insertAt = table.end;
        slot.order = "";
        slot.dir = "";
      } else {
        slot.optsAt = opts.at;
        slot.optsTo = opts.to;
        const ord = literalPropSpan(scan, opts.at, opts.to, "order");
        const dir = literalPropSpan(scan, opts.at, opts.to, "dir");
        slot.orderSpan = ord;
        slot.dirSpan = dir;
        slot.order = ord ? ord.value : "";
        slot.dir = dir ? dir.value : "";
        // A computed `order` cannot be read and must not be overwritten in
        // place — the caller is told, the same as a computed options object.
        if (ord === null || dir === null) { slot.computed = true; delete slot.optsAt; }
      }
      out.push(slot);
      if (out.length >= MAX_SORT_SLOTS) return out;
    }
  }
  return out;
}

/** Where the call's `(` is, skipping a generic that may itself hold braces. */
function callOpen(src, from) {
  let i = from;
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src[i] === "(") return i;
  if (src[i] !== "<") return -1;
  // `useRows<{ slot_date: string; slot_time: string }>(` — the `>` that closes
  // the generic is the one at angle-depth 1 with no brace open, so both are
  // tracked. Anything else takes the closing `>` of a nested shape.
  let angle = 0, brace = 0, quote = "", esc = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === quote) quote = "";
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{" || c === "[" || c === "(") { brace++; continue; }
    if (c === "}" || c === "]" || c === ")") { brace--; continue; }
    if (c === "<") { angle++; continue; }
    if (c === ">") {
      angle--;
      if (angle === 0 && brace === 0) {
        let j = i + 1;
        while (j < src.length && /\s/.test(src[j])) j++;
        return src[j] === "(" ? j : -1;
      }
    }
  }
  return -1;
}

/** The index of the `)` closing the call that opens at `from`. */
function matchParen(src, from) {
  let depth = 0, quote = "", esc = false;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === quote) quote = "";
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "(" || c === "{" || c === "[") { depth++; continue; }
    if (c === ")" && depth === 1) return i;
    if (c === ")" || c === "}" || c === "]") { depth--; continue; }
  }
  return -1;
}

/** The call's first argument, when it is a plain string — the table's name. */
function firstStringArg(src, from, close) {
  let i = from;
  while (i < close && /\s/.test(src[i])) i++;
  const q = src[i];
  if (q !== '"' && q !== "'") return null;
  let value = "";
  for (let j = i + 1; j < close; j++) {
    const c = src[j];
    if (c === "\\") { value += src[j + 1] ?? ""; j++; continue; }
    if (c === q) return { value, end: j + 1 };
    value += c;
  }
  return null;
}

/**
 * The options object, or `false` for none and `null` for one we cannot read.
 *
 * THE THREE ANSWERS ARE THREE DIFFERENT ACTIONS and collapsing any two of them
 * is a bug: none means insert, a literal means rewrite, and anything else means
 * refuse and say so.
 */
function secondArg(src, from, close) {
  let i = from;
  while (i < close && /\s/.test(src[i])) i++;
  if (src[i] !== ",") return false;
  i++;
  while (i < close && /\s/.test(src[i])) i++;
  if (i >= close) return false;
  if (src[i] !== "{") return null;
  const end = matchBrace(src, i);
  if (end < 0 || end > close) return null;
  // A trailing third argument means a shape this was not written for.
  let j = end + 1;
  while (j < close && /\s/.test(src[j])) j++;
  if (j < close) return null;
  return { at: i, to: end };
}

/** The index of the `}` closing the object that opens at `from`. */
function matchBrace(src, from) {
  let depth = 0, quote = "", esc = false;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === quote) quote = "";
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{" || c === "[" || c === "(") { depth++; continue; }
    if (c === "}" && depth === 1) return i;
    if (c === "}" || c === "]" || c === ")") { depth--; continue; }
  }
  return -1;
}

/**
 * Where one string property's VALUE sits, so it can be rewritten in place.
 *
 * IN PLACE AND NOT BY RE-RENDERING THE OBJECT, because the object holds things
 * that are not ours: `usePublicRows("appointments", { date })` is a filter, and
 * an object rebuilt from the two properties this cares about drops it. Only the
 * span between the quotes moves.
 *
 * `undefined` for absent, `null` for present and not a plain string.
 */
function literalPropSpan(src, at, to, name) {
  const re = new RegExp("(^|[{,\\s])" + name + "\\s*:\\s*", "g");
  re.lastIndex = at;
  let m, hit = null;
  while ((m = re.exec(src))) {
    if (m.index >= to) break;
    // Top level of THIS object only — a nested `{ filter: { order: "x" } }`
    // names a different thing.
    if (depthBetween(src, at, m.index) !== 0) continue;
    hit = m;
    break;
  }
  if (!hit) return undefined;
  const start = hit.index + hit[0].length;
  const q = src[start];
  if (q !== '"' && q !== "'") return null;
  let value = "";
  for (let i = start + 1; i < to; i++) {
    const c = src[i];
    if (c === "\\") { value += src[i + 1] ?? ""; i++; continue; }
    if (c === q) return { at: start + 1, to: i, value };
    value += c;
  }
  return null;
}

/** Bracket depth between two offsets, quotes respected. */
function depthBetween(src, from, to) {
  let depth = 0, quote = "", esc = false;
  for (let i = from + 1; i < to; i++) {
    const c = src[i];
    if (quote) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === quote) quote = "";
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{" || c === "[" || c === "(") depth++;
    else if (c === "}" || c === "]" || c === ")") depth--;
  }
  return depth;
}

/** Comments blanked, offsets preserved — never removed, or every index shifts. */
function blankComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
}

/**
 * Rewrite the order of one table's list, on every page that reads it.
 *
 * SITE-WIDE IS THE WHOLE POINT. A table read on the home page and the menu page
 * must come out in the same order in both, and the `page` layer — which edits
 * one page — cannot promise that.
 *
 * BACK TO FRONT, PER FILE, for the reason every structural editor here states:
 * each write changes the length of the source, so a forward pass lands every
 * later offset in whatever moved into it.
 */
export function applySort(pages, table, order, dir) {
  const want = String(table || "");
  const col = String(order || "").trim();
  const way = SORT_DIRS.includes(String(dir || "").trim()) ? String(dir).trim() : "asc";
  if (!want || !col) return { pages: Array.isArray(pages) ? pages : [], changed: [], moved: 0, refused: [] };

  const slots = sortSlots(pages).filter((s) => s.table === want);
  const edits = new Map();
  const refused = [];
  let moved = 0;

  for (const s of slots) {
    if (s.computed) { refused.push({ page: s.page, why: "computed" }); continue; }
    if (s.order === col && (s.dir || "asc") === way) continue;
    if (!edits.has(s.page)) edits.set(s.page, []);
    const mine = edits.get(s.page);
    if (s.insertAt != null) {
      mine.push({ at: s.insertAt, to: s.insertAt, text: ", { order: " + JSON.stringify(col) + ", dir: " + JSON.stringify(way) + " }" });
    } else {
      // WHAT IS ALREADY THERE IS EDITED AND WHAT IS MISSING IS INSERTED, rather
      // than the object being rebuilt: it can hold a filter that is not ours.
      if (s.orderSpan) mine.push({ at: s.orderSpan.at, to: s.orderSpan.to, text: col });
      else mine.push({ at: s.optsAt + 1, to: s.optsAt + 1, text: " order: " + JSON.stringify(col) + "," });
      if (s.dirSpan) mine.push({ at: s.dirSpan.at, to: s.dirSpan.to, text: way });
      else mine.push({ at: s.optsAt + 1, to: s.optsAt + 1, text: " dir: " + JSON.stringify(way) + "," });
    }
    moved++;
  }

  const changed = [];
  const next = (Array.isArray(pages) ? pages : []).map((p) => {
    const mine = edits.get(p && p.path);
    if (!mine || !mine.length) return p;
    let src = p.source;
    // Two insertions can share an offset (an object with neither property), so
    // the sort must be stable at equal `at` — `Array.prototype.sort` is, and
    // both land at the same place in the order they were pushed.
    for (const e of [...mine].sort((a, b) => b.at - a.at)) {
      src = src.slice(0, e.at) + e.text + src.slice(e.to);
    }
    if (src === p.source) return p;
    changed.push(p.path);
    return { ...p, source: src };
  });
  return { pages: next, changed, moved, refused };
}

/**
 * What the model is shown: every list, the table it reads and its order today.
 *
 * GROUPED BY TABLE, because that is the thing being reordered — one table read
 * on three pages is one list to the owner, and showing it three times invites an
 * answer that changes one of them.
 */
export function sortDigest(slots, tables) {
  const lines = [];
  const groups = new Map();
  for (const s of Array.isArray(slots) ? slots : []) {
    const g = groups.get(s.table) || { table: s.table, n: 0, order: s.order, dir: s.dir };
    g.n++;
    // FIRST-SEEN WINS AND A DISAGREEMENT IS STATED, because a table already
    // read in two different orders is exactly the state this lane fixes and the
    // model should be told rather than shown one of the two at random.
    if (s.order && g.order && s.order !== g.order) g.split = true;
    if (!g.order) { g.order = s.order; g.dir = s.dir; }
    groups.set(s.table, g);
  }
  if (!groups.size) return "";
  lines.push("THE LISTS THIS SITE SHOWS, AND THE ORDER THEY COME OUT IN:");
  for (const g of groups.values()) {
    lines.push("  " + g.table + " — ordered by " +
      (g.order ? g.order + " " + (g.dir || "asc") : "nothing in particular") +
      (g.n > 1 ? "  (read on " + g.n + " pages)" : "") +
      (g.split ? "  [the pages DISAGREE about this today]" : ""));
  }
  // THE COLUMNS ARE THE ALLOW-LIST. A sort by a column the table does not have
  // is a 400 from the data API and an empty list on every page that reads it —
  // worse than the wrong order, and silent.
  const byName = new Map((Array.isArray(tables) ? tables : []).map((t) => [t && t.name, t]));
  lines.push("");
  lines.push("WHAT EACH ONE MAY BE ORDERED BY:");
  for (const name of groups.keys()) {
    const t = byName.get(name);
    const cols = t && Array.isArray(t.columns) ? t.columns.map((c) => (typeof c === "string" ? c : c && c.name)).filter(Boolean) : [];
    lines.push("  " + name + ": " + (cols.length ? cols.join(", ") : "(unknown — leave this one alone)"));
  }
  return lines.join("\n");
}

/**
 * Which column a table may really be ordered by.
 *
 * CHECKED HERE AND NOT ONLY IN THE PROMPT, because the failure is silent and
 * total: PostgREST answers a sort by a column that does not exist with a 400,
 * and `useRows` turns that into the list's error state — so every page reading
 * that table shows nothing, on a change the owner asked for and was told worked.
 */
export function sortColumns(tables, name) {
  const t = (Array.isArray(tables) ? tables : []).find((x) => x && x.name === name);
  if (!t || !Array.isArray(t.columns)) return null;
  const cols = t.columns.map((c) => (typeof c === "string" ? c : c && c.name)).filter(Boolean);
  // `id` and `created_at` are stamped on every table by the schema engine and
  // are not in the declared list, so "newest first" would be refused without
  // them — which is one of the commonest asks there is.
  return [...new Set([...cols, "id", "created_at"])];
}

/**
 * A column the list does not have, said in a way the owner can act on.
 *
 * NAMING WHAT IT DOES HAVE IS THE WHOLE VALUE. "I couldn't match that to
 * anything the site stores" — which is what "order the dishes by spiciness"
 * used to get — is both wrong (the list is right there) and unactionable. The
 * columns turn it into one more sentence they can type.
 *
 * `id` and `created_at` are dropped from what is OFFERED even though both are
 * accepted: they are the platform's own, and reading them back to a café owner
 * is noise.
 */
export function sortRefusal({ table = "", column = "", columns = [] } = {}) {
  const own = (Array.isArray(columns) ? columns : []).filter((c) => c !== "id" && c !== "created_at");
  return table + " has nothing called " + column + "." +
    (own.length ? " It has " + own.slice(0, 8).join(", ") + " — say which of those to order by." : "");
}

/**
 * What the customer is told, in their words rather than ours.
 *
 * NOTHING MOVED IS NOT A SUCCESS, and the first draft of this said it was:
 * "✅ appointments now comes out in order of time — on 0 pages", which is the
 * one shape this whole lane must not have. It is reachable on the ordinary
 * path — a table read only through a computed options object refuses every
 * slot — so the tick is conditioned on a page really having changed.
 */
export function sortReply({ table = "", order = "", dir = "asc", changed = [], refused = [] } = {}) {
  // NAMED, NOT COUNTED. A list whose order is worked out in the page's own code
  // cannot be rewritten from outside it, and the owner can act on that by
  // naming the page.
  const left = refused.length
    ? " I left " + refused.map((r) => r.page).join(", ") +
      " alone — that list works its own order out, so changing it needs the page itself."
    : "";
  if (!changed.length) {
    return (refused.length
      ? "I couldn't change how " + table + " is ordered." + left
      : table + " already comes out in that order — nothing to change.");
  }
  const where = changed.length + (changed.length === 1 ? " page" : " pages");
  return "✅ " + table + " now comes out in order of " + order +
    (dir === "desc" ? ", highest first" : ", lowest first") + " — on " + where + "." + left;
}
