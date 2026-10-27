// WHAT HAPPENS AFTER A ROW IS CREATED OR UPDATED — one step, every write path.
//
// The audit of 2026-10-17 (A12-1, A30-3) found the four side effects a site can
// declare — the owner's notification, the submitter's confirmation, the text
// message and the outward webhook — wired only into the data proxy. An order
// is inserted by `handleCheckout` on the owner connection and marked paid by
// the site's Stripe webhook; neither path passed through the proxy, so a shop
// that declared a receipt and a webhook sent neither. This module is the one
// decision all three paths now share; the Worker supplies the four senders.
//
// Every sender is the OWNER'S OWN key from the site's Secrets (RESEND_KEY,
// SENDGRID_KEY or POSTMARK_KEY with EMAIL_FROM; Twilio; WEBHOOK_URL). Nothing
// here can reach the platform's own sender.
//
// WHEN THE PERSON-FACING EFFECTS FIRE. `submission: true` means "a person just
// handed this row over": the proxy's POST, and — for a payable table — the
// moment the order is PAID, not the moment the pending row is written. A
// pending row is a customer on their way to Stripe who may never pay; a
// receipt or an owner email for it would be a promise about money nobody
// took. The webhook is different: it reports every declared action, so the
// pending insert is `created` and the paid flip is `updated`.

/**
 * Run the declared side effects for one row. Never throws, never awaits a
 * sender's delivery beyond handing it off: each dep is fire-and-forget in the
 * Worker, and one failing must not stop the others.
 *
 * deps: { notify(row), confirm(row), sms(row), webhook(action, row) }
 */
export function runRowEffects(deps, { def, action, row, submission = false } = {}) {
  const fired = [];
  if (!def) return fired;
  const r = row && typeof row === "object" ? row : {};
  const call = (name, fn) => {
    if (typeof fn !== "function") return;
    try { fn(); fired.push(name); } catch { /* a sender's fault is its own */ }
  };
  if (submission) {
    call("notify", () => deps.notify(r));
    call("confirm", () => deps.confirm(r));
    call("sms", () => deps.sms(r));
  }
  if (action === "created" || action === "updated" || action === "deleted") {
    call("webhook", () => deps.webhook(action, r));
  }
  return fired;
}

/**
 * The SQL that finds the row a visitor's insert just stored, on the owner
 * connection (A12-2).
 *
 * The kit's insert asks for nothing back on purpose — a collect table has no
 * SELECT, and RETURNING would be refused — so PostgREST answers 201 with an
 * empty body and the proxy used to hand the senders the visitor's own fields,
 * which never carry the managed `id`. The `{fn}` form of confirm and sms looks
 * the row up by id, so it never sent, and a webhook's `data` had no id.
 *
 * Matched on every declared scalar column the visitor sent, newest first. Two
 * identical submissions in the same instant resolve to the newer row: both
 * rows are the same values, so the message is the same; only the id named can
 * be the other one's. Answers null when nothing usable was sent.
 */
export function storedRowQuery(def, sent) {
  if (!def || !def.name || !sent || typeof sent !== "object" || Array.isArray(sent)) return null;
  const declared = new Set((def.columns || []).map((c) => String(typeof c === "string" ? c : c && c.name).toLowerCase()));
  const where = [];
  const params = [];
  for (const [k, v] of Object.entries(sent)) {
    const low = String(k).toLowerCase();
    if (!declared.has(low) || low === "id") continue;
    if (!/^[a-z_][a-z0-9_]{0,62}$/.test(low)) continue;
    if (v === null) { where.push(`"${low}" IS NULL`); continue; }
    if (typeof v === "object") continue;
    where.push(`"${low}" = ?`);
    params.push(typeof v === "boolean" ? v : String(v));
  }
  if (!where.length) return null;
  if (!/^[a-z_][a-z0-9_]{0,62}$/i.test(String(def.name))) return null;
  return {
    sql: `SELECT * FROM "${String(def.name).toLowerCase()}" WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT 1`,
    params,
  };
}

/**
 * The row the side effects get for a proxied POST: the upstream answer when
 * the caller asked for it back; otherwise the stored row read on the owner
 * side; only failing both, what the visitor sent.
 */
export async function resolveCreatedRow({ def, body, sent, lookup }) {
  let row = null;
  try { const j = JSON.parse(body); row = Array.isArray(j) ? j[0] : j; } catch { /* empty 201 */ }
  if (row && typeof row === "object" && row.id != null) return row;
  let given = null;
  try { given = JSON.parse(sent || "null"); } catch { given = null; }
  if (Array.isArray(given)) given = given[0];
  const q = storedRowQuery(def, given);
  if (q && typeof lookup === "function") {
    try {
      const rows = await lookup(q.sql, q.params);
      if (rows && rows[0] && typeof rows[0] === "object") return rows[0];
    } catch { /* fall through to what was sent */ }
  }
  return (row && typeof row === "object") ? row : (given && typeof given === "object" ? given : {});
}

// THE FUNCTION FORM'S BODY IS MODEL-WRITTEN AND BUILT FROM A STRANGER'S FIELDS
// (a name, a message). The template form escapes every value it fills in; the
// function form handed its `body` to the provider as raw HTML. So it is
// reduced here to text plus a short list of bare formatting tags: no
// attributes, no links, no images, no scripts or styles — a visitor's
// "<a href=…>" in a message field arrives as the characters, not as a link
// sent from the owner's domain.
const KEEP = new Set(["p", "br", "b", "strong", "i", "em", "u", "ul", "ol", "li", "h1", "h2", "h3", "h4", "hr", "table", "tr", "td", "th", "tbody", "thead"]);
export function sanitizeMailHtml(html) {
  let s = String(html == null ? "" : html);
  s = s.replace(/<(script|style|iframe|object|embed|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (t) => t.replace(/[&<>"']/g, (c) => ESC[c]);
  // Text is escaped, but an entity the body already wrote (`&amp;`, `&#163;`) is kept.
  const text = (t) => esc(t).replace(/&amp;([a-zA-Z]+|#\d+);/g, "&$1;");
  let out = "";
  const re = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*?(\/?)\s*>/g;
  let last = 0;
  let m;
  while ((m = re.exec(s))) {
    out += text(s.slice(last, m.index));
    const tag = m[2].toLowerCase();
    if (KEEP.has(tag)) out += `<${m[1] ? "/" : ""}${tag}${m[3] && !m[1] ? " /" : ""}>`;
    last = re.lastIndex;
  }
  out += text(s.slice(last));
  return out;
}
