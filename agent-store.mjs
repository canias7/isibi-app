/**
 * THE AGENT BUILDER'S STORE, AND ITS AUTHENTICATED SURFACE.
 *
 * The agents screen (`renderAgents` in `public/chat.js`) kept its agents in
 * `localStorage`: gone on another machine, gone when the browser's storage is
 * cleared, and gone to anyone but the person sitting at that keyboard. This is
 * what it reads and writes instead — `agent.agents` and `agent.agent_messages`
 * in Supabase, behind seven operations on one path prefix.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHOSE ROWS THEY ARE IS NEVER THE BROWSER'S TO SAY.
 *
 * `handleAgentApi` takes `tenant` as an argument and the ONLY caller passes
 * `authUser(request).id` — a token GoTrue verified, in this request. No route
 * here reads an account, a tenant, a uid or an owner off the body or the query
 * string, and `readTenant` refuses anything that is not a plain identifier, so
 * a value that could change the MEANING of a filter cannot reach one.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY EVERY QUERY CARRIES ITS OWN TENANT FILTER, WITH RLS ALREADY IN PLACE.
 *
 * Row level security on both tables is keyed on `agent.tenant_id()`, which
 * reads the request's own JWT. That protects the `authenticated` role — a
 * customer reading their own rows directly. It does NOT protect this code:
 * `service_role` carries BYPASSRLS on Supabase, so a query sent with the
 * service key sees every tenant's rows. **So the wall on this path is the
 * `tenant_id=eq.` filter in the URL, and RLS is the belt underneath it.**
 * Saying that out loud matters more than usual, because the two look
 * interchangeable from the outside and only one of them is doing the work
 * here — a query written without the filter would pass every test that only
 * ever signs in as one account.
 *
 * Its consequence is the shape of `update`, `remove` and `ownsAgent`: the
 * tenant goes in the FILTER, not into a check above the statement, so
 * "somebody else's id" and "an id that does not exist" are one answer (no
 * rows) and neither confirms the other's existence.
 *
 * A message carries no tenant of its own — deliberately, the same rule the
 * table follows: a copy there could disagree with the agent it points at, and
 * the disagreeing case is the one where somebody reads another account's
 * conversation. So a message operation asks about its AGENT first, and the
 * foreign key closes the gap between the question and the write: an agent
 * deleted in between makes the insert fail rather than orphan a row.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT THIS DOES NOT DO.
 *
 * It stores what a person wrote and what they typed. It runs nothing. There is
 * no model here, no reply, no tool and no trigger, and `role` is never sent —
 * the column's own `check (role = 'user')` is what makes a reply impossible
 * rather than merely absent. `agent.runs` and `agent.run_entries` (the
 * execution journal, append-only and fenced) are a different half of the
 * schema with no foreign key to this one, and nothing in this file touches
 * them.
 */

// ── the caps ────────────────────────────────────────────────────────────────
//
// EVERY ONE OF THESE IS THE DATABASE'S OWN NUMBER, and `test/agent-api.test.mjs`
// reads them back out of the migration to prove it. A cap here that is LOOSER
// than the column's check constraint turns a refusal we could phrase into a
// Postgres error nobody can act on; one that is tighter for no reason is a
// limit with no stated author.
export const AGENT_NAME_MAX = 200;
export const AGENT_INSTRUCTIONS_MAX = 8000;
export const AGENT_BODY_MAX = 8000;

/** How many agents one account may hold. Not the database's — ours. */
export const MAX_AGENTS = 200;

/**
 * How much of a conversation one read returns.
 *
 * The NEWEST this many, presented oldest-first. Taking the newest and turning
 * them round is the whole of it: a thread read that took the OLDEST 500 would,
 * on a long conversation, show a screen of history with the part somebody is
 * actually in nowhere on it.
 */
export const MAX_THREAD = 500;

/**
 * How many messages one import may carry.
 *
 * `agent.import_agent` refuses past 500; this is 200, because that is
 * `AGENT_THREAD_MAX` in the browser — the cap on the store being imported FROM,
 * so a bigger number here could not describe any real payload. The guard
 * asserts this is at or under the database's ceiling rather than equal to it:
 * the API may be tighter than the store and may never be looser.
 */
export const MAX_IMPORT_MESSAGES = 200;

/**
 * The import's body allowance. 200 messages at `AGENT_BODY_MAX` is 1.6 MB, so
 * this is that plus room for the instructions, the JSON and the multi-byte
 * case. Every other route keeps `readJsonBody`'s ordinary 128 KB.
 */
export const MAX_IMPORT_BODY = 2 * 1024 * 1024;

/** The schema PostgREST is told to use, per request, on every call. */
export const AGENT_SCHEMA = "agent";

// ── reading what arrived ────────────────────────────────────────────────────

/**
 * A text field, trimmed, or `null`.
 *
 * REFUSES A NON-STRING RATHER THAN COERCING IT. `String(["a"])` is `"a"`, so a
 * caller sending `{name: ["a"]}` would otherwise store an agent called `a` —
 * shipped as a real bug three times in this repository. A number, an object, a
 * boolean and an array are all `null` here, and `null` is the one thing every
 * caller below turns into a named refusal.
 */
export function cleanText(v, max) {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.length > max) return null;
  return t;
}

/**
 * An id, or `null`. A uuid and nothing else.
 *
 * It goes into a PostgREST filter, so the charset is the wall: no comma, no
 * dot, no parenthesis and no quote can reach `id=eq.<x>` to mean something
 * there. Both writers of an id here are `crypto.randomUUID`, so nothing
 * legitimate is turned away by being this strict.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function cleanId(v) {
  return typeof v === "string" && UUID.test(v.trim()) ? v.trim().toLowerCase() : null;
}

/**
 * The tenant, or `null`.
 *
 * It arrives from `authUser` and is a Supabase user id, so in practice a uuid —
 * but this is deliberately a CHARSET rather than the uuid test above, because
 * the one thing that must never happen is this refusing a legitimate account
 * id and locking somebody out of their own agents. What it has to guarantee is
 * narrower than "is a uuid": that no character in it can change what
 * `tenant_id=eq.<t>` selects.
 */
const TENANT_OK = /^[A-Za-z0-9_.:@+-]{1,200}$/;
export function readTenant(v) {
  return typeof v === "string" && TENANT_OK.test(v) ? v : null;
}

/**
 * A message's own time, as an ISO string, or `null` for "use now()".
 *
 * ONLY THE IMPORT SENDS ONE, and it is display metadata: `seq` orders a thread,
 * assigned by the database, so a wrong time here cannot reorder anything. What
 * it is bounded against is the two ways it could be nonsense — a date before
 * this platform existed, and one in the future, which would sit a message at
 * the top of a list for ever. A minute of slack for a browser clock that is
 * slightly ahead; anything outside reads as absent rather than as a refusal,
 * because losing a message's time is worth far less than losing the message.
 */
const AT_FLOOR = Date.UTC(2020, 0, 1);
export function cleanAt(v, now = Date.now()) {
  const ms = typeof v === "number" ? v : NaN;
  if (!Number.isFinite(ms) || ms < AT_FLOOR || ms > now + 60_000) return null;
  return new Date(ms).toISOString();
}

// ── what goes on the wire ───────────────────────────────────────────────────

/** ISO out of Postgres, epoch milliseconds in, because `agentWhen` takes ms. */
const ms = (iso) => {
  const t = Date.parse(iso || "");
  return Number.isFinite(t) ? t : 0;
};

/**
 * One agent, in the shape the agents list already draws.
 *
 * `created`/`updated` and a `preview` line, matching the local record field for
 * field, so the screen's own `agentWhen` and row markup need no second reader.
 * **`preview` is `""` when nothing has been said** — the view answers SQL NULL
 * there, and the browser's `agentPreview` falls back to the instructions, which
 * is a correct rendering rather than a blank row.
 */
export function agentRow(r) {
  return {
    id: String(r && r.id || ""),
    name: String(r && r.name || ""),
    instructions: String(r && r.instructions || ""),
    created: ms(r && r.created_at),
    updated: ms(r && r.updated_at),
    preview: typeof (r && r.last_message) === "string" ? r.last_message : "",
  };
}

/**
 * One message, in the shape the thread already draws.
 *
 * `text`, not `body` — the screen reads `m.text`, and renaming a field on the
 * wire to match the column would be a second vocabulary for one thing. No
 * `role`: every row here is the person's, by the column's own constraint, and a
 * role on the wire would be the first half of a reply the product does not have.
 */
export function messageRow(r) {
  return { id: String(r && r.id || ""), text: String(r && r.body || ""), at: ms(r && r.created_at) };
}

// ── the store ───────────────────────────────────────────────────────────────

/**
 * A failure that names itself.
 *
 * Every refusal from PostgREST arrives with a status and, usually, Postgres's
 * own words. "Couldn't save" with nothing after it is the shape that costs an
 * afternoon, so the status rides on the error and the server's message rides in
 * `detail` — where the ROUTE decides whether the customer sees it. They do not:
 * the sentences below are ours. `detail` is for the log.
 */
function storeFail(what, r) {
  const why = (r && r.body && r.body.message) || (r && r.text) || "";
  const e = new Error(`${what}: HTTP ${r && r.status}${why ? ` — ${why}` : ""}`);
  e.status = (r && r.status) || 0;
  e.detail = why;
  return e;
}

/**
 * The seven operations, over PostgREST.
 *
 * `fetch` and `key` are INJECTED so every one of them can be driven outside a
 * Worker. `key` is the service key and never leaves this process: it goes into
 * a request header and into nothing else — no log line, no response body, no
 * error message this module composes.
 */
export function makeAgentStore({ fetch: doFetch, url, key, schema = AGENT_SCHEMA } = {}) {
  if (typeof doFetch !== "function") throw new TypeError("makeAgentStore: fetch must be a function");
  if (typeof url !== "string" || !url.trim()) throw new TypeError("makeAgentStore: url must be a non-empty string");
  if (typeof key !== "string" || !key.trim()) throw new TypeError("makeAgentStore: key must be a non-empty string");
  const base = url.replace(/\/+$/, "");

  // The schema is not `public`, so PostgREST is told which one PER REQUEST, and
  // the header differs by direction: `content-profile` for a write,
  // `accept-profile` for a read. Sending the wrong one is a request answered
  // against `public`, where none of these relations exist.
  const headers = (write) => ({
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    [write ? "content-profile" : "accept-profile"]: schema,
  });

  async function req(method, path, { body, write = false, prefer } = {}) {
    const h = headers(write);
    const res = await doFetch(`${base}/rest/v1/${path}`, {
      method,
      headers: prefer ? { ...h, prefer } : h,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const text = typeof res.text === "function" ? await res.text() : "";
    let parsed = null;
    if (text) { try { parsed = JSON.parse(text); } catch { parsed = null; } }
    return { ok: !!res.ok, status: res.status, body: parsed, text };
  }

  const rows = (r) => (Array.isArray(r.body) ? r.body : []);
  const t = (tenant) => encodeURIComponent(tenant);

  return {
    /** Every agent of one account, newest first, off the overview view. */
    async list(tenant) {
      const r = await req("GET",
        `agent_overview?tenant_id=eq.${t(tenant)}` +
        `&select=id,name,instructions,created_at,updated_at,last_message` +
        `&order=updated_at.desc&limit=${MAX_AGENTS}`);
      if (!r.ok) throw storeFail("list agents", r);
      return rows(r).map(agentRow);
    },

    /**
     * How many this account holds. Ids only, and one past the ceiling, so the
     * answer the caller needs costs a few hundred bytes rather than every
     * instruction they have ever written.
     */
    async count(tenant) {
      const r = await req("GET", `agents?tenant_id=eq.${t(tenant)}&select=id&limit=${MAX_AGENTS + 1}`);
      if (!r.ok) throw storeFail("count agents", r);
      return rows(r).length;
    },

    /**
     * Does this account own this agent?
     *
     * The tenant is in the filter, so a stranger's id and a nonexistent id are
     * one answer. Its callers turn that into the same 404, which is what keeps
     * this from confirming that somebody else's agent exists.
     */
    async ownsAgent(tenant, id) {
      const r = await req("GET", `agents?id=eq.${id}&tenant_id=eq.${t(tenant)}&select=id&limit=1`);
      if (!r.ok) throw storeFail("read agent", r);
      return rows(r).length === 1;
    },

    /** THE ID IS OURS, never the caller's: a client cannot choose a primary key. */
    async create(tenant, { id, name, instructions }) {
      const r = await req("POST", "agents", {
        write: true,
        prefer: "return=representation",
        body: [{ id, tenant_id: tenant, name, instructions }],
      });
      if (!r.ok) throw storeFail("create agent", r);
      const row = rows(r)[0];
      if (!row) throw storeFail("create agent", { status: r.status, text: "the row did not come back" });
      return agentRow(row);
    },

    /** Zero rows back means "not this account's", and the caller answers 404. */
    async update(tenant, id, { name, instructions }) {
      const r = await req("PATCH", `agents?id=eq.${id}&tenant_id=eq.${t(tenant)}`, {
        write: true,
        prefer: "return=representation",
        body: { name, instructions },
      });
      if (!r.ok) throw storeFail("update agent", r);
      return rows(r).length === 1 ? agentRow(rows(r)[0]) : null;
    },

    /** The messages go with it, by the foreign key's own `on delete cascade`. */
    async remove(tenant, id) {
      const r = await req("DELETE", `agents?id=eq.${id}&tenant_id=eq.${t(tenant)}`, {
        prefer: "return=representation",
      });
      if (!r.ok) throw storeFail("delete agent", r);
      return rows(r).length === 1;
    },

    /**
     * One thread. THE NEWEST `MAX_THREAD`, TURNED ROUND.
     *
     * `order=seq.desc&limit=N` then reverse, because a thread is read at its
     * live end; ordering ascending with a limit would pin a long conversation
     * to its oldest screen for ever.
     */
    async messages(agentId) {
      const r = await req("GET",
        `agent_messages?agent_id=eq.${agentId}&select=id,body,created_at,seq` +
        `&order=seq.desc&limit=${MAX_THREAD}`);
      if (!r.ok) throw storeFail("read messages", r);
      return rows(r).map(messageRow).reverse();
    },

    /** NO `role` IS SENT. The column's default and its check decide. */
    async addMessage(agentId, { id, body, at }) {
      const row = { id, agent_id: agentId, body };
      if (at) row.created_at = at;
      const r = await req("POST", "agent_messages", {
        write: true,
        prefer: "return=representation",
        body: [row],
      });
      if (!r.ok) throw storeFail("save message", r);
      const got = rows(r)[0];
      if (!got) throw storeFail("save message", { status: r.status, text: "the row did not come back" });
      return messageRow(got);
    },

    /**
     * One agent and its whole conversation, in one transaction.
     *
     * The RPC is what makes a re-pressed import safe: it either happened or it
     * did not, so a retry after a failure cannot leave half an agent behind or
     * make a second copy of a whole one. It answers the new id.
     */
    async importOne(tenant, { name, instructions, messages }) {
      const r = await req("POST", "rpc/import_agent", {
        write: true,
        body: { p_tenant: tenant, p_name: name, p_instructions: instructions, p_messages: messages },
      });
      if (!r.ok) throw storeFail("import agent", r);
      const id = typeof r.body === "string" ? r.body : null;
      if (!cleanId(id)) throw storeFail("import agent", { status: r.status, text: "no id came back" });
      return id;
    },
  };
}

// ── the surface ─────────────────────────────────────────────────────────────

/** Every path this handles, so `worker.js` and the guard read ONE list. */
export const AGENT_ROUTES = Object.freeze({
  "/api/agent/list": "GET",
  "/api/agent/messages": "GET",
  "/api/agent/create": "POST",
  "/api/agent/update": "POST",
  "/api/agent/delete": "POST",
  "/api/agent/message": "POST",
  "/api/agent/import": "POST",
});

/** Which routes read a body, so the caller knows whether to parse one. */
export const AGENT_POST_ROUTES = Object.freeze(
  Object.keys(AGENT_ROUTES).filter((p) => AGENT_ROUTES[p] === "POST"));

/**
 * How big a body one route may carry, or `undefined` for the ordinary allowance.
 *
 * **THE ROUTE NAME LIVES HERE RATHER THAN AT THE DISPATCH**, and that is not
 * only tidiness. Written inline it was `url.pathname === "/api/agent/import" ? …`
 * in `worker.js`, which reads to `test/api-auth.test.mjs` as a DISPATCH POINT —
 * a route whose gate must follow it — and the gate for all seven of these sits
 * ABOVE the block. So a correct, gated route reported as unauthenticated. One
 * caller, and it asks by path rather than carrying a second copy of the name.
 */
export function agentBodyMax(path) {
  return path === "/api/agent/import" ? MAX_IMPORT_BODY : undefined;
}

const ok = (body) => ({ status: 200, body: { ok: true, ...body } });
const no = (status, error, extra) => ({ status, body: { error, ...(extra || {}) } });

/** The one answer for "not yours" and "no such agent". */
const NO_AGENT = () => no(404, "that agent isn't here any more");

/**
 * A store failure, as one sentence plus a log line.
 *
 * `detail` carries Postgres's own words and is deliberately NOT put in front of
 * a customer — a constraint name is no use to anybody typing into a text box —
 * but it IS logged, because a save that fails with nothing written down is the
 * shape this repository keeps paying for.
 */
function broke(what, e, log) {
  if (typeof log === "function") log(`agent ${what} failed:`, e && e.message);
  const status = e && e.status >= 400 && e.status < 500 ? 400 : 502;
  return no(status, "couldn't save that just now — nothing was lost, try again", { retry: true });
}

/**
 * Handle one call.
 *
 * Answers `{status, body}`, or `null` for a path that is not ours — so the
 * caller's dispatch and this module cannot disagree about what is handled.
 *
 * `tenant` MUST come from verified authentication. Nothing in here reads an
 * account from `body` or `query`, and a tenant this cannot read refuses the
 * whole call rather than falling back to anything.
 */
export async function handleAgentApi({ path, method, query, body, tenant, store, newId, now, log } = {}) {
  if (!Object.hasOwn(AGENT_ROUTES, path)) return null;
  if (AGENT_ROUTES[path] !== method) return no(405, "wrong method for that");

  const who = readTenant(tenant);
  // A TENANT WE CANNOT READ IS A REFUSAL, NEVER AN UNFILTERED QUERY. There is
  // no sensible fallback: every statement below is scoped by this value, so
  // proceeding without it would mean proceeding across accounts.
  if (!who) return no(401, "sign in required");

  const mint = typeof newId === "function" ? newId : () => crypto.randomUUID();
  const at = typeof now === "function" ? now : () => Date.now();
  const b = body && typeof body === "object" ? body : {};
  const q = query || new URLSearchParams();

  try {
    if (path === "/api/agent/list") {
      return ok({ agents: await store.list(who) });
    }

    if (path === "/api/agent/messages") {
      const id = cleanId(q.get("id"));
      if (!id) return no(400, "which agent?");
      if (!(await store.ownsAgent(who, id))) return NO_AGENT();
      return ok({ id, messages: await store.messages(id) });
    }

    if (path === "/api/agent/create") {
      const name = cleanText(b.name, AGENT_NAME_MAX);
      const instructions = cleanText(b.instructions, AGENT_INSTRUCTIONS_MAX);
      if (!name) return no(400, "give it a name first");
      if (!instructions) return no(400, "say what it should do");
      if ((await store.count(who)) >= MAX_AGENTS) {
        return no(409, `that's as many agents as one account can hold (${MAX_AGENTS}) — delete one first`);
      }
      return ok({ agent: await store.create(who, { id: mint(), name, instructions }) });
    }

    if (path === "/api/agent/update") {
      const id = cleanId(b.id);
      const name = cleanText(b.name, AGENT_NAME_MAX);
      const instructions = cleanText(b.instructions, AGENT_INSTRUCTIONS_MAX);
      if (!id) return no(400, "which agent?");
      if (!name) return no(400, "give it a name first");
      if (!instructions) return no(400, "say what it should do");
      const agent = await store.update(who, id, { name, instructions });
      return agent ? ok({ agent }) : NO_AGENT();
    }

    if (path === "/api/agent/delete") {
      const id = cleanId(b.id);
      if (!id) return no(400, "which agent?");
      return (await store.remove(who, id)) ? ok({ id }) : NO_AGENT();
    }

    if (path === "/api/agent/message") {
      const id = cleanId(b.id);
      const text = cleanText(b.body, AGENT_BODY_MAX);
      if (!id) return no(400, "which agent?");
      if (!text) return no(400, "there was nothing to send");
      // OWNERSHIP FIRST, then the insert. The window between them is closed by
      // the foreign key: an agent deleted in between makes this fail rather
      // than leave a message pointing at nothing.
      if (!(await store.ownsAgent(who, id))) return NO_AGENT();
      const saved = await store.addMessage(id, { id: mint(), body: text, at: cleanAt(b.at, at()) });
      return ok({ id, message: saved });
    }

    if (path === "/api/agent/import") {
      const name = cleanText(b.name, AGENT_NAME_MAX);
      const instructions = cleanText(b.instructions, AGENT_INSTRUCTIONS_MAX);
      if (!name) return no(400, "an agent being brought over needs its name");
      if (!instructions) return no(400, "an agent being brought over needs its instructions");
      const raw = Array.isArray(b.messages) ? b.messages : [];
      if (raw.length > MAX_IMPORT_MESSAGES) {
        return no(413, `that conversation is longer than one import can carry (${MAX_IMPORT_MESSAGES} messages)`);
      }
      // A MESSAGE THAT CANNOT BE READ IS COUNTED AND SAID, NEVER DROPPED IN
      // SILENCE. The local store is not deleted, so somebody can go and look at
      // what did not come over — which is only worth anything if they are told
      // there was something.
      const messages = [];
      let unreadable = 0;
      for (const m of raw) {
        const text = cleanText(m && m.text, AGENT_BODY_MAX);
        if (!text) { unreadable++; continue; }
        const stamp = cleanAt(m && m.at, at());
        messages.push(stamp ? { body: text, at: stamp } : { body: text });
      }
      const id = await store.importOne(who, { name, instructions, messages });
      return ok({ id, imported: messages.length, unreadable });
    }
  } catch (e) {
    return broke(path.slice("/api/agent/".length), e, log);
  }

  // UNREACHABLE BY CONSTRUCTION and answered anyway: the membership test above
  // and the branches here are two lists of the same names, and a route added to
  // one and not the other must not fall out of this function as `undefined`.
  return no(500, "that isn't wired up");
}
