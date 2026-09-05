// The `rules` layer: what a table DOES, without touching a single page.
//
// WHY THIS EXISTS. Everything the designer can declare at build time was frozen
// the moment the build finished. Measured, not inferred: the addon lane merges
// with `normalizeSchema`, whose rule is "first declaration wins, and later ones
// contribute any COLUMNS the first did not have" — so a table on a live site
// could gain a column and NOTHING else, ever, and a designer that tried to turn
// on confirmations had them dropped SILENTLY. Driven through the real
// normaliser: `confirm DROPPED · payment DROPPED · noOverlap DROPPED`.
//
// What that made impossible on a site that already exists — every one of these
// is a thing a real business asks for in its first week:
//
//   "email the customer when they book"        confirm
//   "text me when someone books"               sms
//   "stop taking two bookings for one slot"    unique / noOverlap
//   "let people browse without signing in"     the read/write pair
//   "one entry per person"                     oncePerUser
//   "close the form, we're fully booked"       retired
//
// THE LAYER IS DEFINED BY WHAT THE PAGES NEVER SEE. Every rule here is enforced
// in Postgres or read out of `_meta` on the request path, so switching one on
// changes no page source, needs no container and publishes nothing. That is what
// makes it a rung BELOW `look` rather than a variant of `addon`: one cheap model
// call and one schema apply. A rule that needs a page — a Buy button, a form
// field — is an addon and is turned away here rather than half-done.
//
// Plain module with its side effects injected, like `site-apply.mjs` and
// `site-ask.mjs`, so every decision is tested with no network and no Worker.

import { READ_LEVELS, WRITE_LEVELS, ACCESS_PRESETS, resolveAccess } from "../site-access.mjs";
import { modelsFor } from "./build-models.mjs";

/**
 * Haiku, deliberately, and the reason is the validation rather than the task
 * being easy. Every field this returns is checked against the table's REAL
 * columns and types before it reaches the schema engine, so the failure mode is
 * a refusal rather than a wrong rule — and a rules change that costs 2 credits
 * instead of 0.3 is a rung that stops being worth having.
 */
/**
 * THE PICKED MODEL, NOT A HARDCODED ONE (owner, 2026-08-31).
 *
 * Every small call on this platform was pinned to `claude-haiku-4-5`, so a
 * customer who had picked Grok still had Anthropic in their path — and when
 * Anthropic refused on billing, the whole cheap ladder went down with it while
 * builds carried on fine. Run 93 measured that: a `css` edit answered 503 in
 * 5.3s having spent nothing, and the lane it was testing never ran.
 *
 * DERIVED FROM THE TABLE rather than restated, so it cannot drift from the
 * picker, and it resolves to DEFAULT_PICKER — which is what a caller that
 * forgets to thread the picker gets. That is deliberately the platform default
 * and never Haiku: a forgotten hop should land on the model everything else
 * uses, not quietly back on the provider this change exists to leave.
 */
export const RULES_MODEL = modelsFor().quick;
export const RULES_MAX_TOKENS = 1400;

/** How many tables one instruction may change. "Cap both forms" is a real ask. */
export const MAX_RULE_TABLES = 4;

/**
 * WHAT CAN BE SWITCHED OFF AGAIN, AND WHY IT IS NOT EVERYTHING.
 *
 * `confirm` and `sms` are read out of `_meta` on the write path, so removing the
 * declaration really does stop the sending. `retired` is re-emitted as a REVOKE
 * on every apply, so it flips both ways on its own.
 *
 * The constraints are DDL. `applySiteSchema` is additive — every statement is
 * `IF NOT EXISTS` — so dropping `unique` from the spec leaves the index standing
 * in Postgres while `_meta` says it is gone. Offering that as a `clear` would be
 * a rule reported as removed that still refuses the customer's second booking,
 * which is the worst shape a failure can take here. It is refused with a reason
 * instead, and dropping them properly is its own piece of work.
 */
// `webhooks` joins them for exactly the same reason and no other: it is read out
// of `_meta` on the write path by `firesFor`, so dropping the declaration really
// does stop the sending. Nothing in Postgres holds it, so there is no additive
// DDL to leave standing behind a rule reported as removed.
export const CLEARABLE = ["confirm", "sms", "webhooks"];

/** Named so the refusal can say WHICH rule it could not take away. */
export const NOT_CLEARABLE = ["unique", "uniqueci", "nooverlap", "onceperuser", "maxrows"];

export const RULES_TOOL = {
  name: "write_table_rules",
  description:
    "Change what one of this site's tables DOES — who may read or write it, whether it emails or texts on a new " +
    "entry, and what it refuses. Never what any page looks like.",
  input_schema: {
    type: "object",
    properties: {
      tables: {
        type: "array",
        description:
          "One entry per table this instruction actually changes, and nothing else. A table you do not mention is " +
          "left exactly as it is, and so is every rule you do not mention on a table you do.\n" +
          "RETURN AN EMPTY ARRAY IF THIS CANNOT BE DONE BY CHANGING A RULE. Anything that needs a page to change — " +
          "a new button, a new form field, a different layout — is not this. Saying you could not do it is cheap and " +
          "correct; guessing at the nearest rule changes how a real business's data behaves.",
        items: {
          type: "object",
          properties: {
            table: { type: "string", description: "The table name, exactly as listed below." },
            read: {
              type: "string",
              enum: READ_LEVELS,
              description:
                "Who may READ the rows. \"public\" is anyone at all, signed in or not — this is what \"let people " +
                "browse without an account\" means, and it is the commonest thing asked for here. \"members\" is " +
                "anyone signed in to the site. \"own\" is only the person who created the row. \"none\" is nobody: " +
                "the owner still sees everything in their own panel, so this is right for a contact form.\n" +
                "LEAVE IT OUT unless they are changing who can see this. The current value is listed below.",
            },
            write: {
              type: "string",
              enum: WRITE_LEVELS,
              description:
                "Who may ADD to it. \"anyone\" is a public form a stranger can submit. \"members\" is anyone signed " +
                "in. \"own\" means a signed-in member creating rows of their own. \"none\" means nobody through the " +
                "site — the owner still edits it in their panel, which is what a menu or a price list wants.\n" +
                "LEAVE IT OUT unless they are changing who can add to this.",
            },
            confirm: {
              type: "object",
              description:
                "EMAIL THE PERSON WHO FILLED THE FORM IN, as soon as they submit. Only when they asked for that.\n" +
                "The owner needs their own email key saved in Secrets for anything to send; that is their side and " +
                "not a reason to leave this out.",
              properties: {
                to: { type: "string", description: "The column holding the address, exactly as listed below. It must be a column this table really has." },
                subject: { type: "string", description: "The subject line. Write it as the business would." },
                body: { type: "string", description: "The message. `{column}` is filled in from the entry — \"Thanks {name}, we'll see you at {slot}.\"" },
              },
              required: ["to", "subject", "body"],
            },
            sms: {
              type: "object",
              description: "TEXT them instead of, or as well as, emailing. Only when they asked for a text message.",
              properties: {
                to: { type: "string", description: "The column holding the phone number, exactly as listed below." },
                body: { type: "string", description: "The message. `{column}` is filled in from the entry. Keep it to one or two sentences." },
              },
              required: ["to", "body"],
            },
            unique: {
              type: "array",
              items: { type: "string" },
              description:
                "COLUMNS THAT TOGETHER MAY NOT REPEAT — the answer to \"stop two people booking the same slot\". " +
                "`[\"slot_date\",\"slot_time\"]` refuses a second entry for that date AND time. Name the columns that " +
                "identify the thing being taken, never a name or an email.",
            },
            noOverlap: {
              type: "object",
              description:
                "NO TWO ENTRIES MAY OVERLAP IN TIME. Use this ONLY when the table has two whole-number columns " +
                "holding a start and an end — minutes past midnight, say. It is refused otherwise, because a " +
                "half-applied version of this is a booking system that quietly takes double bookings. When there are " +
                "no such columns, plain `unique` is the right answer.",
              properties: {
                start: { type: "string", description: "The whole-number column holding the start." },
                end: { type: "string", description: "The whole-number column holding the end." },
              },
              required: ["start", "end"],
            },
            oncePerUser: {
              type: "array",
              items: { type: "string" },
              description: "ONE ENTRY PER SIGNED-IN MEMBER, per these columns — one review per customer per product.",
            },
            maxRows: {
              type: "integer",
              description: "REFUSE ANYTHING PAST THIS MANY ENTRIES — twenty places on a course, forty seats at an event.",
            },
            retired: {
              type: "boolean",
              description:
                "TRUE closes the table to the public entirely: nobody can read it or add to it through the site, and " +
                "the owner keeps every entry already in it and can still see them. This is \"stop taking bookings\", " +
                "\"we're fully booked\", \"close the form\".\n" +
                "FALSE reopens one that was closed.",
            },
            // THE RIGHT LANE FOR THIS, and the addon lane is deliberately not.
            // That one may touch an existing table for exactly two things —
            // payments and a public view — because both need a PAGE as well as a
            // schema change. A webhook needs no page at all: it fires on the data
            // path when a row moves. So it belongs where the other no-page rules
            // live, which is also the lane that can turn it off again.
            webhooks: {
              type: "array",
              items: { type: "string", enum: ["created", "updated", "deleted"] },
              description:
                "SEND THIS TABLE'S ENTRIES TO ANOTHER SYSTEM as they happen — a CRM, a warehouse, a Slack channel. " +
                "List which events should fire: [\"created\"] for new entries only, or all three to include edits and " +
                "deletions. The owner sets the destination in Secrets as WEBHOOK_URL; until they do, nothing is sent. " +
                "Use \"clear\" with \"webhooks\" to stop them.",
            },
            clear: {
              type: "array",
              items: { type: "string", enum: CLEARABLE },
              description:
                "TURN A RULE OFF: \"confirm\" stops the email to the customer, \"sms\" stops the text, \"webhooks\" stops " +
                "sending entries to the other system. Only these can be switched off; anything else is left alone and " +
                "they are told so.",
            },
          },
          required: ["table"],
        },
      },
    },
    required: ["tables"],
  },
};

const RULES_SYSTEM =
  "You change the rules a small business's website applies to what it stores — who can see an entry, who can add " +
  "one, whether the customer gets an email, and what the site refuses. You are given the site's tables, the " +
  "columns they really have, and one instruction from the owner.\n\n" +
  "CHANGE ONLY WHAT THEY ASKED FOR. Every rule already there is there because it was wanted. A rule you do not " +
  "mention keeps what it has, so there is never a need to restate one.\n\n" +
  "THESE RULES DECIDE WHO SEES A REAL BUSINESS'S CUSTOMER DATA. Opening a table wider than they asked for is the " +
  "one mistake here that cannot be taken back — a booking list read by anyone is somebody's name, phone number and " +
  "address in public. When the instruction does not plainly say to open something up, leave the read and write as " +
  "they are.\n\n" +
  "If nothing they asked for is a rule, return an empty list. It costs them nothing and they are told why.";

/**
 * The tables, their columns WITH TYPES, and what each one already does.
 *
 * TYPES ARE HERE BECAUSE ONE RULE NEEDS THEM. `noOverlap` is silently skipped by
 * the schema engine unless start and end are INTEGER columns, so a model that
 * cannot see the types will declare it on a pair of text columns and produce a
 * booking table that reports a rule it does not have.
 *
 * WHAT IS ALREADY ON IS STATED for the same reason `schemaDigest` states what
 * the schema permits: absent-means-unchanged is only usable by a model that can
 * see what "unchanged" currently is, and "turn the confirmation off" is not
 * answerable without it.
 */
export function rulesDigest(tables) {
  const out = [];
  for (const t of Array.isArray(tables) ? tables : []) {
    if (!t || !t.name) continue;
    const cols = (Array.isArray(t.columns) ? t.columns : [])
      .map((c) => (typeof c === "string" ? { name: c, type: "text" } : c))
      .filter((c) => c && c.name);
    const pair = resolveAccess(t);
    out.push("TABLE " + t.name);
    out.push("  columns: " + (cols.map((c) => c.name + " (" + String(c.type || "text").toLowerCase() + ")").join(", ") || "(none declared)"));
    out.push("  read: " + pair.read + "   write: " + pair.write);
    const on = [];
    if (t.confirm) on.push(t.confirm.fn ? "confirm (site's own function)" : "confirm → emails " + t.confirm.to);
    if (t.sms) on.push(t.sms.fn ? "sms (site's own function)" : "sms → texts " + t.sms.to);
    if (t.unique) on.push("unique on " + [].concat(t.unique).join(" + "));
    if (t.uniqueCI) on.push("unique (ignoring case) on " + [].concat(t.uniqueCI).join(" + "));
    if (t.noOverlap) on.push("noOverlap on " + t.noOverlap.start + "…" + t.noOverlap.end);
    if (t.oncePerUser) on.push("oncePerUser on " + [].concat(t.oncePerUser).join(" + "));
    if (t.maxRows) on.push("maxRows " + t.maxRows);
    if (t.retired) on.push("CLOSED to the public");
    out.push("  rules now: " + (on.length ? on.join(" · ") : "none"));
  }
  return out.join("\n");
}

export function rulesRequest({ instruction, tables, model = RULES_MODEL }) {
  return {
    model,
    max_tokens: RULES_MAX_TOKENS,
    tools: [RULES_TOOL],
    tool_choice: { type: "tool", name: "write_table_rules" },
    system: [{ type: "text", text: RULES_SYSTEM }],
    messages: [{
      role: "user",
      content: "WHAT THIS SITE STORES\n" + rulesDigest(tables) +
        "\n\nWHAT THEY ASKED FOR\n" + String(instruction || "").trim().slice(0, 2000),
    }],
  };
}

const IDENT = /^[a-z][a-z0-9_]{0,40}$/;

/** Column names off a stored table, lowercased, with their declared types. */
function colTypes(t) {
  const m = new Map();
  for (const c of Array.isArray(t && t.columns) ? t.columns : []) {
    const name = String(typeof c === "string" ? c : (c && c.name) || "").toLowerCase();
    if (name) m.set(name, String((c && c.type) || "text").toLowerCase());
  }
  return m;
}

/** Every named column must be one the table really declares. */
function pickCols(raw, cols, max) {
  const list = (Array.isArray(raw) ? raw : (typeof raw === "string" ? [raw] : []))
    .map((c) => String(c).toLowerCase())
    .filter((c) => IDENT.test(c) && cols.has(c));
  return [...new Set(list)].slice(0, max);
}

const INT_TYPES = ["int", "integer", "int4", "int8", "bigint", "smallint", "serial"];

/**
 * What came back, checked against the site's real tables and columns.
 *
 * EVERY REJECTION IS ITS OWN AND THE COUNT IS THE OUTCOME. A table nobody
 * offered, a column that does not exist, an unusable `noOverlap`: each is
 * dropped on its own rather than failing the ones beside it, and zero changes is
 * an outcome the caller reports rather than an error.
 *
 * `refused` IS RETURNED RATHER THAN SWALLOWED, and that is not tidiness: a rule
 * this layer cannot express is the one case where the customer must hear a
 * reason, or a booking table that still takes double bookings looks exactly like
 * one where the change worked.
 */
export function readRules(reply, tables) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const raw = (use && use.input && use.input.tables) || [];
  const byName = new Map();
  for (const t of Array.isArray(tables) ? tables : []) if (t && t.name) byName.set(String(t.name).toLowerCase(), t);

  const out = [];
  const refused = [];
  for (const c of Array.isArray(raw) ? raw : []) {
    if (!c || typeof c !== "object") continue;
    const name = String(c.table || "").toLowerCase();
    const prior = byName.get(name);
    if (!prior) continue;
    const cols = colTypes(prior);
    const change = { table: prior.name };
    let touched = false;

    // THE PAIR. Read and write move independently — "let people browse" changes
    // the read and must not quietly open the write with it.
    if (typeof c.read === "string" && READ_LEVELS.includes(c.read.toLowerCase())) { change.read = c.read.toLowerCase(); touched = true; }
    if (typeof c.write === "string" && WRITE_LEVELS.includes(c.write.toLowerCase())) { change.write = c.write.toLowerCase(); touched = true; }

    // CONFIRM AND SMS ARE VALIDATED BY THE MODULES THAT SEND THEM, not here.
    // Two readers of one declaration is how a table ends up looking as though it
    // confirms and does not; these carry the raw shape through and the schema
    // engine's own `normalizeConfirm`/`normalizeSms` decide, against the same
    // columns, on the merged table.
    if (c.confirm && typeof c.confirm === "object" && !Array.isArray(c.confirm)) {
      const to = String(c.confirm.to || "").toLowerCase();
      if (cols.has(to) && String(c.confirm.subject || "").trim() && String(c.confirm.body || "").trim()) {
        change.confirm = { to, subject: String(c.confirm.subject).trim(), body: String(c.confirm.body).trim() };
        touched = true;
      } else refused.push({ table: prior.name, rule: "confirm", why: "no-column" });
    }
    if (c.sms && typeof c.sms === "object" && !Array.isArray(c.sms)) {
      const to = String(c.sms.to || "").toLowerCase();
      if (cols.has(to) && String(c.sms.body || "").trim()) {
        change.sms = { to, body: String(c.sms.body).trim() };
        touched = true;
      } else refused.push({ table: prior.name, rule: "sms", why: "no-column" });
    }

    const uniq = pickCols(c.unique, cols, 6);
    if (uniq.length) { change.unique = uniq; touched = true; }
    const once = pickCols(c.oncePerUser, cols, 6);
    if (once.length) { change.oncePerUser = once; touched = true; }

    // NO-OVERLAP NEEDS TWO INTEGER COLUMNS AND IS REFUSED OTHERWISE. The schema
    // engine SKIPS it silently on anything else (`console.error("noOverlap
    // skipped")`), so accepting it here would report a rule the database does
    // not have — on the one table where being wrong means two customers in one
    // chair. `unique` is named in the refusal because it is the answer.
    if (c.noOverlap && typeof c.noOverlap === "object" && !Array.isArray(c.noOverlap)) {
      const s = String(c.noOverlap.start || "").toLowerCase(), e = String(c.noOverlap.end || "").toLowerCase();
      const intish = (col) => INT_TYPES.some((t) => (cols.get(col) || "").startsWith(t));
      if (s !== e && cols.has(s) && cols.has(e) && intish(s) && intish(e)) { change.noOverlap = { start: s, end: e }; touched = true; }
      else refused.push({ table: prior.name, rule: "noOverlap", why: "not-integers" });
    }

    const max = Math.floor(Number(c.maxRows));
    if (Number.isFinite(max) && max > 0) { change.maxRows = Math.min(max, 10000000); touched = true; }
    if (c.retired === true || c.retired === false) { change.retired = c.retired; touched = true; }

    // CLEARING. The enum bounds it to what really goes away; anything else is
    // reported rather than dropped, because a rule the customer believes is off
    // and is not is worse than one they know we could not take off.
    const clear = (Array.isArray(c.clear) ? c.clear : [])
      .map((x) => String(x).toLowerCase())
      .filter((x, i, a) => a.indexOf(x) === i);
    const okClear = clear.filter((x) => CLEARABLE.includes(x));
    for (const bad of clear.filter((x) => NOT_CLEARABLE.includes(x))) refused.push({ table: prior.name, rule: bad, why: "cannot-clear" });
    if (okClear.length) { change.clear = okClear; touched = true; }

    if (touched) out.push(change);
    if (out.length >= MAX_RULE_TABLES) break;
  }
  return { changes: out, refused };
}

/**
 * The stored spec with the changes applied — named fields override, absent means
 * unchanged, `clear` removes.
 *
 * THIS IS NOT `normalizeSchema`'S MERGE AND MUST NOT BECOME IT. That one is on
 * the BUILD path, where two tables of one name is a model mistake and first-wins
 * is the protection that stopped a duplicate destroying the first's guarantees.
 * Here the second declaration IS the change. Two different intents, so two
 * different functions rather than a flag on one — the caller should have to say
 * which it means.
 *
 * A COLUMN IS NEVER REMOVED AND NO TABLE IS EVER DROPPED. `_meta` is what the
 * data API derives from, so dropping a column here hides it from every read
 * while the values sit in Postgres — invisible data loss, and nothing in the
 * pipeline can see it. Closing a table is `retired`, which keeps the rows.
 */
export function mergeRules(spec, changes) {
  const tables = (spec && Array.isArray(spec.tables) ? spec.tables : []).map((t) => ({ ...t }));
  const byName = new Map(tables.map((t) => [String(t.name).toLowerCase(), t]));
  const applied = [];
  for (const c of Array.isArray(changes) ? changes : []) {
    const t = byName.get(String(c && c.table || "").toLowerCase());
    if (!t) continue;
    const fields = [];
    for (const k of ["read", "write", "confirm", "sms", "webhooks", "unique", "oncePerUser", "noOverlap", "maxRows", "retired"]) {
      if (c[k] === undefined) continue;
      t[k] = c[k];
      fields.push(k);
    }
    // ONE HALF OF THE PAIR MOVES ON ITS OWN, and nothing has to complete it.
    // `resolveAccess` takes the half that is absent from the PRESET named by
    // `access`, which is still the table's own — so setting only `read` leaves
    // the write exactly as it was. Writing both halves here would look tidier
    // and is the same answer, until `access` is ever changed independently, at
    // which point the copy is a second opinion about a question `site-access.mjs`
    // exists to answer once.
    for (const k of Array.isArray(c.clear) ? c.clear : []) {
      if (!CLEARABLE.includes(k)) continue;
      if (t[k] === undefined || t[k] === null) continue;
      t[k] = null;
      fields.push("cleared " + k);
    }
    if (fields.length) applied.push({ table: t.name, fields });
  }
  return { spec: { ...(spec || {}), tables }, applied };
}

const SAYS = {
  read: "who can see it",
  write: "who can add to it",
  confirm: "the confirmation email",
  sms: "the text message",
  unique: "the no-duplicates rule",
  oncePerUser: "the one-per-customer rule",
  noOverlap: "the no-double-booking rule",
  maxRows: "the limit on how many",
  retired: "whether it's open",
  webhooks: "sending entries to your other system",
  "cleared confirm": "the confirmation email, now off",
  "cleared sms": "the text message, now off",
  "cleared webhooks": "sending entries to your other system, now off",
};

const WHY = {
  "not-integers": "that table has no whole-number start and end times to compare, so a no-overlap rule there wouldn't actually stop anything — a plain no-duplicates rule on the date and time would",
  "no-column": "that table has no column holding the address to send to",
  "cannot-clear": "that one can't be taken off again yet",
};

/** What the customer is told. One sentence per table, then anything refused. */
export function rulesReply({ applied = [], refused = [] } = {}) {
  const bits = [];
  for (const a of applied) {
    const said = (a.fields || []).map((f) => SAYS[f] || f);
    if (said.length) bits.push("**" + a.table + "** — changed " + said.join(", ") + ".");
  }
  let msg = bits.length ? bits.join(" ") : "";
  if (!bits.length && refused.length) msg = "I couldn't make that change.";
  else if (!bits.length) msg = "Nothing there was a rule I could change.";
  else msg = "✅ " + msg;
  // A REFUSAL WITH NO WORDING STILL HAS TO SAY SOMETHING. Falling through to
  // silence is how a rule the customer asked for goes missing with the reply
  // reading like a success — the failure this whole `refused` list exists to
  // prevent, arriving through the one place that renders it.
  const seen = new Set();
  for (const r of refused) {
    const key = r.rule + ":" + r.why;
    if (seen.has(key)) continue;
    seen.add(key);
    msg += " One thing I left alone: " + (WHY[r.why] || "the " + r.rule + " rule — I couldn't apply that one") + ".";
  }
  return msg.replace(/\s+/g, " ").trim();
}

/** The four token kinds, in the shape `pageCredits` prices. One price table, everywhere. */
export function rulesUsage(reply, model = RULES_MODEL) {
  const u = (reply && reply.usage) || {};
  return {
    in: Number(u.input_tokens) || 0,
    out: Number(u.output_tokens) || 0,
    cacheRead: Number(u.cache_read_input_tokens) || 0,
    cacheWrite: Number(u.cache_creation_input_tokens) || 0,
    model,
  };
}

/**
 * The whole rules layer.
 *
 * `deps.send(request)` → the Messages API response.
 * `deps.apply(spec)`   → applies the merged schema. Truthy on success.
 *
 * NO PAGE CALL, NO CONTAINER, NO PUBLISH. The rules are enforced in Postgres and
 * on the request path, so nothing a visitor downloads changes.
 *
 * ESCALATES ONLY WHEN THERE WAS NOTHING TO WORK WITH — a site with no tables at
 * all. A model that read the tables and matched no rule does NOT escalate: the
 * rungs above cannot change a rule either, so sending them up spends ~25 credits
 * to fail differently. That is the same call `runDataEdit` makes, for the same
 * reason.
 */
export async function runRulesEdit(deps, { instruction, tables, model = RULES_MODEL } = {}) {
  const usable = (Array.isArray(tables) ? tables : []).filter((t) => t && t.name);
  if (!usable.length) return { ok: false, escalate: true, reason: "no-tables", usage: null };

  let reply;
  try {
    reply = await deps.send(rulesRequest({ instruction, tables: usable, model }));
  } catch (e) {
    return { ok: false, escalate: false, reason: "send", error: e, usage: null };
  }
  const usage = rulesUsage(reply, model);
  const { changes, refused } = readRules(reply, usable);
  // THE NO-MATCH REPLY IS COMPOSED HERE, not at the call site, and that is not
  // tidiness: a refusal carries the reason a rule could not be applied, and a
  // caller that writes its own sentence eventually writes one that does not
  // mention the refusal at all — which reads as "nothing happened" on the one
  // path where the customer most needs to hear why.
  if (!changes.length) return { ok: false, escalate: false, reason: "no-match", refused, usage, msg: rulesReply({ refused }) };

  const { spec, applied } = mergeRules({ tables: usable }, changes);
  // ONE APPLY FOR THE WHOLE SPEC, not one per table. `applySiteSchema` walks
  // every table and re-emits its grants and policies, so handing it a subset
  // would revoke and re-grant only those and leave the rest untouched — correct
  // today and exactly the kind of partial application that stops being correct
  // the moment anything cross-table is added.
  // THE CALLER MAY RESERVE BEFORE THE SCHEMA IS TOUCHED (2026-09-05) — the
  // data layer's rule: the usage is known, nothing is written yet, and a
  // ledger that refuses answers `unbilled` with no DDL emitted.
  if (typeof deps.before === "function") {
    let go = false;
    try { go = !!(await deps.before(usage)); } catch { go = false; }
    if (!go) return { ok: false, escalate: false, reason: "unbilled", usage, applied: [] };
  }
  let ok = false;
  try { ok = !!(await deps.apply(spec)); }
  catch (e) { return { ok: false, escalate: false, reason: "apply", error: e, usage, applied }; }
  if (!ok) return { ok: false, escalate: false, reason: "apply", usage, applied };

  return { ok: true, spec, applied, refused, usage, msg: rulesReply({ applied, refused }) };
}
