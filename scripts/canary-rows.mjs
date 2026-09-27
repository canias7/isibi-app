// ── THE CANARY'S ONE ROW: SEEN BEFORE, SEEN AFTER, AND PUT BACK ─────────────
//
// Test 4b's D1 changes one row of a live site's database through the real app:
// the Sea Salt Focaccia's price on fold-lane-bakery, 4.5 to 4.6. A saved site
// version cannot undo that — a version holds pages, and the row lives in the
// site's own Postgres — so the test carries its own recovery, with no model
// call, and this module decides what that recovery may write.
//
// ONE FIELD OF ONE ROW, AND ONLY FROM THE VALUE THE TEST SET. The recovery
// writes the target field back to what the baseline read just before the
// message, and only while that field reads exactly the value the message asked
// for. A missing row, a row that is no longer the one named, or a value nobody
// here set is REFUSED and said, never overwritten. Every other difference
// between the baseline and a later read is REPORTED and left as it is: this
// module never writes a field the test did not change.
//
// TWO READERS, BECAUSE THEY ANSWER TWO QUESTIONS. The owner route
// (`/api/site/<slug>/rows/<table>`) reads each stored row whole, as the
// database driver returns it — what the database holds. The visitor route
// (`/api/db/<slug>/data/<table>`) is what the site's own pages read — what a
// visitor is served — and its body is kept as TEXT, so "the same as before"
// can be asked byte for byte rather than after a JSON parse that forgets
// `4.50` was ever `4.50`.
//
// THE CHECK AND THE WRITE ARE ONE STATEMENT. A read that finds the value this
// test set, followed by a plain `UPDATE … WHERE id=?`, leaves a window in which
// another write can land and be overwritten — reproduced: the recovery read
// 4.6, another writer set 5.2, and the write put 4.5 over it and reported the
// row restored. So the recovery's write is the owner route's CONDITIONAL form,
// `{$set, $if}`: Postgres writes the row only if, when the write runs, it is
// still the row named, with the value this test set. A row that no longer
// matches is not written, and the route answers 409 conflict — reported here,
// never retried and never called restored.
//
// PURE AND INJECTED. The canary hands in the three transports (the two reads
// and the owner route's PATCH), so every decision here is driven by tests with
// no site, no token and no database.

/** The owner route's own page size ceiling (`MAX_LIMIT` in site-owner.mjs). */
export const OWNER_ROWS_LIMIT = 200;

const DECIMAL = /^-?(0|[1-9]\d*)(\.\d+)?$/;

/**
 * A number the way a price is compared: "4.5" for 4.5, "4.50" and "4.5". The
 * owner route may answer a NUMERIC column as a string and a REAL one as a
 * number, so both are read — and anything that is not plainly a decimal (an
 * empty string, `null`, a boolean, `1e21`, " 4.5") is NOT one, because
 * `Number("")` is 0 and a zero is a price.
 */
export function decimalOf(v) {
  const s = typeof v === "number" ? (Number.isFinite(v) ? String(v) : "") : typeof v === "string" ? v : "";
  if (!DECIMAL.test(s)) return null;
  let [whole, frac = ""] = s.split(".");
  frac = frac.replace(/0+$/, "");
  if (whole === "-0" && !frac) whole = "0";
  return frac ? `${whole}.${frac}` : whole;
}

/** Two stored values are the same value only when they serialise the same. */
const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);

/**
 * A reader's answer as a row list, or a refusal naming why it is not one.
 * `owner` expects the owner route's `{rows}`; otherwise a bare array (the
 * visitor route). Every row must be an object with a positive integer id,
 * once. A FULL PAGE FROM THE OWNER ROUTE IS REFUSED: 200 rows may be the whole
 * table or the first page of a longer one, and a comparison over part of a
 * table would call the rest of it unchanged.
 */
export function readRowList(res, { owner = false } = {}) {
  if (!res || res.status !== 200) return { ok: false, why: `status ${(res && res.status) || 0}` };
  let body = res.json;
  if (body === undefined || body === null) {
    if (typeof res.text !== "string") return { ok: false, why: "no body" };
    try { body = JSON.parse(res.text); } catch { return { ok: false, why: "not JSON" }; }
  }
  const list = owner ? (body && Array.isArray(body.rows) ? body.rows : null) : (Array.isArray(body) ? body : null);
  if (!list) return { ok: false, why: owner ? "no rows list in the answer" : "not a list" };
  if (owner && list.length >= OWNER_ROWS_LIMIT) return { ok: false, why: `${list.length} rows is a full page, so the table may be longer than one read` };
  const seen = new Set();
  for (const r of list) {
    if (!r || typeof r !== "object" || Array.isArray(r)) return { ok: false, why: "a row that is not an object" };
    if (!Number.isSafeInteger(r.id) || r.id <= 0) return { ok: false, why: "a row without a positive integer id" };
    if (seen.has(r.id)) return { ok: false, why: `id ${r.id} appears twice` };
    seen.add(r.id);
  }
  const out = { ok: true, rows: [...list].sort((a, b) => a.id - b.id) };
  if (typeof res.text === "string" && !owner) out.text = res.text;
  return out;
}

/**
 * Every difference between two row lists: each field that differs (a field on
 * one side only differs from its absence), each row that appeared and each row
 * that went. Nothing is left out for being unimportant — which differences
 * matter is decided by the caller, and only after all of them are known.
 */
export function rowDiff(before, after) {
  const b = new Map((Array.isArray(before) ? before : []).map((r) => [r.id, r]));
  const a = new Map((Array.isArray(after) ? after : []).map((r) => [r.id, r]));
  const changed = [], added = [], gone = [];
  for (const [id, row] of b) {
    const now = a.get(id);
    if (!now) { gone.push(id); continue; }
    for (const k of [...new Set([...Object.keys(row), ...Object.keys(now)])].sort()) {
      if (!same(row[k], now[k])) changed.push({ id, field: k, before: row[k] === undefined ? null : row[k], after: now[k] === undefined ? null : now[k] });
    }
  }
  for (const id of a.keys()) if (!b.has(id)) added.push(id);
  return { changed, added: added.sort((x, y) => x - y), gone: gone.sort((x, y) => x - y) };
}

/** The target row, found by its id and checked against what names it. */
export function findTarget(rows, spec) {
  const row = (Array.isArray(rows) ? rows : []).find((r) => r && r.id === spec.id) || null;
  if (!row) return { ok: false, why: "row-missing" };
  for (const [k, v] of Object.entries(spec.match || {})) {
    if (row[k] !== v) return { ok: false, why: "not-the-row", detail: `${k} reads ${JSON.stringify(row[k])}, not ${JSON.stringify(v)}` };
  }
  return { ok: true, row };
}

/**
 * CAN THE TEST START HERE? Both readers answered, both find the target row as
 * the one named, and both read its field as exactly the value the message
 * changes it FROM. A baseline that fails any of these is not where this test
 * was written to start, and nothing is sent.
 */
export function baselineVerdict(base, spec) {
  if (!base || !base.owner || !base.owner.ok) return { ok: false, why: "owner-unreadable", detail: base && base.owner ? base.owner.why : "not read" };
  if (!base.pub || !base.pub.ok) return { ok: false, why: "visitor-unreadable", detail: base.pub ? base.pub.why : "not read" };
  const o = findTarget(base.owner.rows, spec);
  if (!o.ok) return { ok: false, why: o.why, detail: o.detail || "", reader: "owner" };
  const p = findTarget(base.pub.rows, spec);
  if (!p.ok) return { ok: false, why: p.why, detail: p.detail || "", reader: "visitor" };
  const od = decimalOf(o.row[spec.field]), pd = decimalOf(p.row[spec.field]);
  if (od !== spec.from || pd !== spec.from) {
    return { ok: false, why: "unexpected-value", detail: `${spec.field} reads ${JSON.stringify(o.row[spec.field])} (owner) and ${JSON.stringify(p.row[spec.field])} (visitor), not ${spec.from}` };
  }
  return { ok: true, why: "at-baseline", raw: o.row[spec.field] };
}

/**
 * WHAT CHANGED, AGAINST THE BASELINE TAKEN JUST BEFORE THE MESSAGE: the one
 * change the test expects (the target field, from `from` to `to`) and
 * everything else, each named. `exact` is the expected change and nothing
 * beside it; anything else is a finding to report, never to put back.
 */
export function changeVerdict(baseRows, nowRows, spec) {
  const d = rowDiff(baseRows, nowRows);
  const isTarget = (c) => c.id === spec.id && c.field === spec.field;
  const t = d.changed.find(isTarget) || null;
  const others = d.changed.filter((c) => !isTarget(c));
  const beforeRaw = (findTarget(baseRows, spec).row || {})[spec.field];
  const nowT = findTarget(nowRows, spec);
  const afterRaw = nowT.ok ? nowT.row[spec.field] : undefined;
  const expected = !!t && nowT.ok && decimalOf(beforeRaw) === spec.from && decimalOf(afterRaw) === spec.to;
  return {
    expected,
    exact: expected && !others.length && !d.added.length && !d.gone.length,
    target: { before: beforeRaw === undefined ? null : beforeRaw, after: afterRaw === undefined ? null : afterRaw, changed: !!t, row: nowT.ok ? "found" : nowT.why },
    others, added: d.added, gone: d.gone,
  };
}

/**
 * WHAT THE RECOVERY MAY WRITE, decided from the read taken immediately before
 * the write. Three answers and no fourth:
 *   patch   — the target field reads exactly `to`, the value this test set:
 *             write back the BASELINE'S OWN value, that field alone;
 *   none    — the field already holds the baseline value exactly: nothing to
 *             write (the message did not change it, or it is already back);
 *   refuse  — anything else: the row is gone, it is no longer the row named, or
 *             the field reads a value nobody here set. Not overwritten.
 * `baseRaw` is the value as the owner route read it at the baseline, so a
 * NUMERIC stored as "4.5" goes back as "4.5" and not as a re-typed number.
 */
export function restorePlan(nowRows, spec, baseRaw) {
  const t = findTarget(nowRows, spec);
  if (!t.ok) return { act: "refuse", why: t.why, detail: t.detail || `no row ${spec.id} in ${spec.table}` };
  const now = t.row[spec.field];
  if (decimalOf(baseRaw) !== spec.from) return { act: "refuse", why: "no-baseline", detail: `the baseline value ${JSON.stringify(baseRaw)} is not ${spec.from}` };
  if (same(now, baseRaw)) return { act: "none", why: "at-baseline", detail: `${spec.field} already reads ${JSON.stringify(now)}` };
  if (decimalOf(now) === spec.to) {
    // Written only while the row, when the write runs, is still the one named
    // and still reads the value just read — in the form the owner route read it.
    return { act: "patch", why: "reads-what-this-test-set", id: spec.id, body: { $set: { [spec.field]: baseRaw }, $if: { ...(spec.match || {}), [spec.field]: now } }, from: now };
  }
  return { act: "refuse", why: "unexpected-value", detail: `${spec.field} reads ${JSON.stringify(now)}, which is neither the baseline ${JSON.stringify(baseRaw)} nor ${spec.to}, the value this test set — left as it is` };
}

/**
 * Did the owner route's own answer to the PATCH change that one field and
 * nothing else? It returns the row as it now stands; every other field must be
 * what the read just before the write held.
 */
export function patchVerdict(res, preRow, spec, baseRaw) {
  const status = (res && res.status) || 0;
  const j = res && res.json && typeof res.json === "object" ? res.json : {};
  if (status === 409 && j.code === "conflict") {
    // ANOTHER WRITE GOT THERE FIRST: the row no longer matched when the write
    // ran, so Postgres wrote nothing. What it reads now is read after, and
    // decides nothing.
    const cur = j.row && typeof j.row === "object" ? j.row : null;
    const was = preRow ? JSON.stringify(preRow[spec.field] === undefined ? null : preRow[spec.field]) : "?";
    return {
      ok: false, why: "conflict", conflict: true, current: cur,
      detail: `the row changed after the recovery read ${spec.field} as ${was}${cur ? ` (it now reads ${JSON.stringify(cur[spec.field] === undefined ? null : cur[spec.field])}${Object.entries(spec.match || {}).some(([k, v]) => cur[k] !== v) ? `, and it is no longer ${Object.values(spec.match || {}).join(", ")}` : ""})` : ""}, so the write matched nothing and nothing was written`,
    };
  }
  if (status === 400 && j.error === "nothing to update") {
    return { ok: false, why: "no-conditional-write", detail: "this Worker does not take a conditional write, so it refused it and nothing was written" };
  }
  if (status !== 200 || !j.row || typeof j.row !== "object") {
    return { ok: false, why: `the write answered ${status}`, detail: j.error || "" };
  }
  // A write answered 200 without saying its condition held is a write nobody
  // can tell was conditional.
  if (j.conditional !== true) return { ok: false, why: "not-conditional", detail: "the write answered 200 without saying its condition was applied" };
  const row = j.row;
  if (!same(row[spec.field], baseRaw)) return { ok: false, why: "not-written", detail: `${spec.field} came back ${JSON.stringify(row[spec.field])}` };
  const d = rowDiff([{ ...preRow, [spec.field]: baseRaw }], [row]);
  return d.changed.length ? { ok: false, why: "row-moved", detail: d.changed.map((c) => c.field).join(", "), changed: d.changed } : { ok: true, row };
}

/**
 * IS THE TABLE BACK? The target row must equal its baseline row field for
 * field on the owner route and on the visitor route; the visitor route's whole
 * body is also compared byte for byte, which holds only when nothing else in
 * the table moved. Every remaining difference is listed, and it is not ours to
 * put back.
 */
export function restoreVerdict(base, final, spec) {
  if (!final || !final.owner || !final.owner.ok || !final.pub || !final.pub.ok) {
    return { restored: false, why: "unreadable", detail: `${final && final.owner ? final.owner.why || "ok" : "not read"} / ${final && final.pub ? final.pub.why || "ok" : "not read"}` };
  }
  const bo = findTarget(base.owner.rows, spec), fo = findTarget(final.owner.rows, spec);
  const bp = findTarget(base.pub.rows, spec), fp = findTarget(final.pub.rows, spec);
  const ownerSame = bo.ok && fo.ok && !rowDiff([bo.row], [fo.row]).changed.length;
  const visitorSame = bp.ok && fp.ok && !rowDiff([bp.row], [fp.row]).changed.length;
  const owner = rowDiff(base.owner.rows, final.owner.rows);
  // NULL WHEN THERE IS NO BASELINE TEXT TO COMPARE — a recovery run after the
  // fact has only the proposal's parsed record — never `false`, which would
  // read as a difference nobody measured.
  const bytes = typeof base.pub.text === "string" && typeof final.pub.text === "string" ? base.pub.text === final.pub.text : null;
  return {
    restored: ownerSame && visitorSame,
    why: ownerSame && visitorSame ? "restored" : "target-differs",
    bytes,
    others: owner.changed.filter((c) => !(c.id === spec.id && c.field === spec.field)),
    added: owner.added, gone: owner.gone,
  };
}

/** Did the route say it wrote the row? Only a 200 that says its condition held. */
function routeWrote(res) {
  return !!(res && res.status === 200 && res.json && res.json.conditional === true && res.json.row);
}

/**
 * THE RECOVERY, END TO END: read, decide, write one field, read again.
 *   readers  { owner: () => Promise<res>, pub: () => Promise<res> }
 *   patch    (id, body) => Promise<res>, the owner route's PATCH
 *   base     the baseline: { owner, pub } as `readRowList` answered them
 *   after    the read taken just after the edit, so what moved SINCE it is
 *            named on its own
 * The read immediately before the write is the one the plan is made from, so a
 * change that landed since the after-read is seen here and not overwritten.
 */
export async function restoreRow({ spec, base, after = null, readers, patch }) {
  const out = { at: new Date().toISOString(), pre: null, plan: null, patched: null, wrote: false, conflict: null, final: null, verdict: null, moved: null };
  out.pre = await readBoth(readers);
  if (!out.pre.owner.ok) {
    out.plan = { act: "refuse", why: "owner-unreadable", detail: out.pre.owner.why };
    return out;
  }
  if (after && after.owner && after.owner.ok) out.moved = rowDiff(after.owner.rows, out.pre.owner.rows);
  const baseRaw = (findTarget(base.owner.rows, spec).row || {})[spec.field];
  out.plan = restorePlan(out.pre.owner.rows, spec, baseRaw);
  if (out.plan.act === "patch") {
    const res = await patch(out.plan.id, out.plan.body);
    const preRow = findTarget(out.pre.owner.rows, spec).row;
    out.patched = { status: (res && res.status) || 0, verdict: patchVerdict(res, preRow, spec, baseRaw) };
    out.conflict = out.patched.verdict.conflict ? out.patched.verdict.detail : null;
    out.wrote = routeWrote(res);
  }
  out.final = await readBoth(readers);
  out.verdict = restoreVerdict(base, out.final, spec);
  return out;
}

/**
 * THE SAME RECOVERY WHEN THE TEST'S OWN RUN COULD NOT FINISH IT — a reply that
 * never came, a runner that died between the edit and the write. There is no
 * fresh baseline then, so the value written back is the one the proposal
 * recorded (`spec.from`, in the type the owner route reads it as), and the
 * visitor read is compared with that record. The rule is the same one: that
 * field alone, and only while it reads exactly the value the test set.
 *   write  false reads and decides only — nothing is written
 */
export async function recoverRow({ spec, record, readers, patch, write = false }) {
  const out = { at: new Date().toISOString(), pre: null, plan: null, patched: null, conflict: null, final: null, verdict: null, record: null, sent: false, wrote: false };
  out.pre = await readBoth(readers);
  if (!out.pre.owner.ok) {
    out.plan = { act: "refuse", why: "owner-unreadable", detail: out.pre.owner.why };
    return out;
  }
  const t = findTarget(out.pre.owner.rows, spec);
  const nowRaw = t.ok ? t.row[spec.field] : undefined;
  const baseRaw = typeof nowRaw === "number" ? Number(spec.from) : spec.from;
  out.plan = restorePlan(out.pre.owner.rows, spec, baseRaw);
  if (out.plan.act === "patch" && write) {
    const res = await patch(out.plan.id, out.plan.body);
    out.sent = true;
    out.patched = { status: (res && res.status) || 0, verdict: patchVerdict(res, t.row, spec, baseRaw) };
    out.conflict = out.patched.verdict.conflict ? out.patched.verdict.detail : null;
    out.wrote = routeWrote(res);
  }
  out.final = out.sent ? await readBoth(readers) : out.pre;
  // The baseline this is judged against: what the read before the write held,
  // with the one field at its recorded value, and the proposal's record for
  // what a visitor is served.
  const base = {
    owner: { ok: true, rows: out.pre.owner.rows.map((r) => (r.id === spec.id ? { ...r, [spec.field]: baseRaw } : r)) },
    pub: { ok: true, rows: Array.isArray(record) ? record : [] },
  };
  out.verdict = restoreVerdict(base, out.final, spec);
  out.record = out.final.pub.ok ? rowDiff(Array.isArray(record) ? record : [], out.final.pub.rows) : null;
  return out;
}

/**
 * DOES THIS WORKER WRITE ONLY WHILE THE ROW STILL MATCHES? Asked before the
 * test changes anything, with a conditional write no row can meet: the row
 * must have its own id and the id 0 at once. It changes nothing on any
 * Worker. One that takes the form runs the UPDATE, which matches nothing, and
 * answers 409 conflict (or 404 if the row is gone). One that predates the form
 * finds nothing writable in the body and answers 400 "nothing to update"
 * before any statement. Anything else cannot tell, and cannot-tell refuses.
 */
export function probeBody(spec) {
  return { $set: { [spec.field]: spec.from }, $if: { id: 0 } };
}

export function probeVerdict(res) {
  const status = (res && res.status) || 0;
  const j = res && res.json && typeof res.json === "object" ? res.json : {};
  if (status === 409 && j.code === "conflict") return { ok: true, why: "enforced", status };
  if (status === 404 && j.error === "no such row") return { ok: true, why: "enforced", status, detail: "the row is gone" };
  if (status === 400 && j.error === "nothing to update") {
    return { ok: false, why: "no-conditional-write", status, detail: "this Worker does not take a conditional write, so the recovery could not put the value back" };
  }
  return { ok: false, why: "cannot-tell", status, detail: `a conditional write that cannot match answered ${status}${j.error ? " " + JSON.stringify(j.error) : ""}` };
}

/** Both readers, each answer checked. */
export async function readBoth(readers) {
  const [o, p] = await Promise.all([
    Promise.resolve().then(() => readers.owner()).catch((e) => ({ status: 0, why: String(e && e.message || e) })),
    Promise.resolve().then(() => readers.pub()).catch((e) => ({ status: 0, why: String(e && e.message || e) })),
  ]);
  return { at: new Date().toISOString(), owner: readRowList(o, { owner: true }), pub: readRowList(p) };
}

/**
 * Is this card the named row's own? It starts with the whole name, and what
 * follows the name is a space and then neither a letter nor a digit — the
 * price, a separator — so "Sea Salt Focaccia Deluxe £5.00" is not the Sea Salt
 * Focaccia's card.
 */
export function lineIsFor(line, name) {
  if (typeof line !== "string" || typeof name !== "string" || !name || !line.startsWith(name)) return false;
  return /^\s+[^\p{L}\p{N}\s]/u.test(line.slice(name.length));
}

/**
 * WHAT THE ORDER PAGE SHOWED, compared line for line. `lines` are the loaf
 * list's labels as the page drew them; the target's line is the one that
 * starts with its name. `before` must show `shown.before`; after the edit the
 * target must show `shown.after` and every other line must be what it was;
 * after the recovery every line must be what it was.
 */
export function shownVerdict(beforeLines, nowLines, spec, want) {
  const name = String((spec.match && spec.match.name) || "");
  const pick = (lines) => (Array.isArray(lines) ? lines : []).filter((l) => lineIsFor(l, name));
  const rest = (lines) => (Array.isArray(lines) ? lines : []).filter((l) => !lineIsFor(l, name));
  const t = pick(nowLines);
  if (t.length !== 1) return { ok: false, why: t.length ? "target-twice" : "target-not-shown", line: t.join(" / ") };
  if (!t[0].includes(want)) return { ok: false, why: "wrong-price", line: t[0] };
  const a = rest(beforeLines), b = rest(nowLines);
  const othersSame = a.length === b.length && a.every((l, i) => l === b[i]);
  return othersSame ? { ok: true, line: t[0] } : { ok: false, why: "other-lines-changed", line: t[0], before: a, after: b };
}

/** The account a person reads. */
export function describeRows(r, spec) {
  const L = [];
  const val = (v) => JSON.stringify(v === undefined ? null : v);
  L.push(`ROW CHECK — ${spec.table} id ${spec.id} (${Object.values(spec.match || {}).join(", ")}), ${spec.field} ${spec.from} -> ${spec.to}, and back`);
  if (!r) { L.push("  not run"); return L.join("\n"); }
  const b = r.baseline;
  if (b) {
    L.push(`  baseline   ${b.at}  owner ${b.owner.ok ? `${b.owner.rows.length} rows` : "UNREADABLE (" + b.owner.why + ")"}, visitor ${b.pub.ok ? `${b.pub.rows.length} rows` : "UNREADABLE (" + b.pub.why + ")"}  ->  ${r.baselineVerdict.ok ? `the target reads ${val(r.baselineVerdict.raw)}` : "REFUSED: " + r.baselineVerdict.why + (r.baselineVerdict.detail ? " — " + r.baselineVerdict.detail : "")}`);
    if (r.record) L.push(`  record     ${r.record.same ? "the baseline's visitor read equals the proposal's record" : `the table moved since the proposal's record: ${describeDiff(r.record.diff)}`}`);
    if (r.planAtBaseline) L.push(`  recovery   against this baseline: ${r.planAtBaseline.act} (${r.planAtBaseline.why})${r.planAtBaseline.detail ? " — " + r.planAtBaseline.detail : ""}`);
  }
  if (r.capability) L.push(capabilityLine(r.capability));
  const shownLine = (k, label) => {
    const s = r.shown && r.shown[k];
    if (s) L.push(`  shown      ${label}  ${s.ok ? s.url + " (" + (s.version || "?") + "): " + (s.target || "(no line)") : "UNREADABLE (" + s.why + ")"}${s.verdict ? (s.verdict.ok ? "  ok" : "  FAIL " + s.verdict.why) : ""}`);
  };
  shownLine("before", "before  ");
  if (r.change) {
    const c = r.change;
    L.push(`  after      ${spec.field} ${val(c.target.before)} -> ${val(c.target.after)}  ${c.exact ? "EXACT: the one expected change and nothing else" : c.expected ? "expected change, WITH other changes" : "NOT the expected change"}`);
    for (const o of c.others) L.push(`             other change: id ${o.id} ${o.field} ${val(o.before)} -> ${val(o.after)}  (reported, not put back)`);
    if (c.added.length) L.push(`             rows added: ${c.added.join(", ")}  (reported, not removed)`);
    if (c.gone.length) L.push(`             rows gone: ${c.gone.join(", ")}  (reported, not put back)`);
  }
  shownLine("afterEdit", "edited  ");
  if (r.restore) {
    const x = r.restore;
    if (x.skipped) L.push(`  restore    SKIPPED: ${x.skipped}`);
    else {
      L.push(`  restore    plan ${x.plan ? x.plan.act + " (" + x.plan.why + ")" + (x.plan.detail ? " — " + x.plan.detail : "") : "-"}`);
      if (x.plan && x.plan.act === "patch") L.push(`             PATCH /rows/${spec.table}/${spec.id} ${JSON.stringify(x.plan.body)} -> ${x.patched ? x.patched.status : "not sent"}  ${x.patched && x.patched.verdict.ok ? "that field alone changed" : "FAIL " + (x.patched ? x.patched.verdict.why + " " + (x.patched.verdict.detail || "") : "")}`);
      if (x.conflict) L.push(`  CONFLICT   ${x.conflict}`);
      if (x.moved && (x.moved.changed.length || x.moved.added.length || x.moved.gone.length)) L.push(`             moved since the after-read: ${describeDiff(x.moved)}  (reported, not put back)`);
      if (x.verdict) {
        const sent = x.plan && x.plan.act === "patch";
        const state = !x.verdict.restored ? "NOT RESTORED (" + x.verdict.why + ")"
          : x.wrote ? "RESTORED: the row is its baseline again on both readers"
          : sent ? "AT BASELINE, but NOT by this recovery: its write changed nothing"
          : "AT BASELINE: nothing was written, and the row is its baseline on both readers";
        L.push(`  final      ${state}; visitor read ${x.verdict.bytes ? "byte-identical to the baseline" : "NOT byte-identical to the baseline"}`);
        for (const o of x.verdict.others || []) L.push(`             still different: id ${o.id} ${o.field} ${val(o.before)} -> ${val(o.after)}  (not ours to put back)`);
      }
    }
  }
  shownLine("afterRestore", "restored");
  return L.join("\n");
}

/** The recovery run's own account. */
export function describeRecovery(x, spec, { write = false, capability = null } = {}) {
  const L = [];
  const val = (v) => JSON.stringify(v === undefined ? null : v);
  L.push(`ROW RECOVERY — ${spec.table} id ${spec.id} (${Object.values(spec.match || {}).join(", ")}), ${spec.field} back to ${spec.from} only if it reads ${spec.to}; ${write ? "WRITES" : "a dry run: nothing is written"}`);
  if (!x) { L.push("  not run"); return L.join("\n"); }
  const t = x.pre && x.pre.owner.ok ? findTarget(x.pre.owner.rows, spec) : null;
  L.push(`  read       ${x.pre ? x.pre.at : "-"}  owner ${x.pre && x.pre.owner.ok ? x.pre.owner.rows.length + " rows" : "UNREADABLE"}, visitor ${x.pre && x.pre.pub.ok ? x.pre.pub.rows.length + " rows" : "UNREADABLE"}${t && t.ok ? `; the target reads ${val(t.row[spec.field])}` : t ? "; target " + t.why : ""}`);
  if (capability) L.push(capabilityLine(capability));
  L.push(`  plan       ${x.plan ? x.plan.act + " (" + x.plan.why + ")" + (x.plan.detail ? " — " + x.plan.detail : "") : "-"}`);
  if (x.plan && x.plan.act === "patch") {
    L.push(x.sent
      ? `  write      PATCH /rows/${spec.table}/${spec.id} ${JSON.stringify(x.plan.body)} -> ${x.patched.status}  ${x.patched.verdict.ok ? "that field alone changed" : "FAIL " + x.patched.verdict.why + " " + (x.patched.verdict.detail || "")}`
      : `  write      NOT SENT (${capability && !capability.ok ? "the Worker cannot make a conditional write" : "dry run"}): PATCH /rows/${spec.table}/${spec.id} ${JSON.stringify(x.plan.body)}`);
  }
  if (x.conflict) L.push(`  CONFLICT   ${x.conflict}`);
  if (x.verdict && x.sent) {
    L.push(`  final      ${!x.verdict.restored ? "NOT RESTORED (" + x.verdict.why + ")" : x.wrote ? "RESTORED: the row is its recorded value again on both readers" : "AT ITS RECORDED VALUE, but NOT by this recovery: its write changed nothing"}`);
  }
  if (x.record) L.push(`  record     ${!x.record.changed.length && !x.record.added.length && !x.record.gone.length ? "the visitor read equals the proposal's record" : "differs from the proposal's record: " + describeDiff(x.record) + "  (reported, not put back)"}`);
  return L.join("\n");
}

function capabilityLine(c) {
  return `  condition  ${c.ok ? "the Worker writes only while the row still matches: a conditional write no row can meet answered " + c.status + " and changed nothing" : "REFUSED: " + (c.detail || c.why)}`;
}

function describeDiff(d) {
  const bits = [];
  for (const c of d.changed || []) bits.push(`id ${c.id} ${c.field} ${JSON.stringify(c.before)} -> ${JSON.stringify(c.after)}`);
  if ((d.added || []).length) bits.push(`added ${d.added.join(", ")}`);
  if ((d.gone || []).length) bits.push(`gone ${d.gone.join(", ")}`);
  return bits.join("; ") || "nothing";
}
