/**
 * CODER'S CARDS STAY OPEN UNTIL ANSWERED, AND A JOB PAUSES WHILE ONE WAITS (A4 of the recheck of 2026-11-14; the owner: "Fix
 * base on Claude Code docs, please").
 *
 * Claude Code: "Questions stay open until you answer them"; "permission prompts, including plan approval, never auto-resolve
 * on idle" (its tools reference). In its cloud sessions: "If Claude asks a question and the session sits idle, you can still
 * answer when you come back, up to environment expiry, and the session continues from your answer" (Claude Code on the web),
 * and "after a few minutes without activity, a session's VM pauses with its files saved" (cloud environments).
 *
 * Coder's way, on its Fly.io machines that stop when quiet with their disk kept: a card that waits inside a turn (a permission
 * card, the plan's, a question card, the key card, an environment card) is answered at once while the job is there. Once it
 * has waited PARK_MS, or at the job's time limit, the job PAUSES: it ends as "parked", saved with the call it waits on (the
 * record below), its branch saved as at any job's end, and its machine may stop. The card stays open in the chat. The owner's
 * answer, minutes or hours later, starts a job that takes the turn up again at that call: the answer is the call's result, in
 * the words it gives today, and the turn goes on. Stop closes it as a Stop on a waiting card does.
 *
 * No Node modules here: Coder's Worker uses the same record (src/coder-routes.mjs).
 */
import { NOT_NOW } from "./coder-perms.mjs";

/** How long a card waits inside its job before the job pauses ("after a few minutes without activity"). */
export const PARK_MS = 5 * 60 * 1000;
/** What a paused job's end says when Coder said nothing before its card. */
export const PARKED_SUMMARY = "waiting for the owner's answer";
/** What the waiting call is told when the owner presses Stop instead of answering (Coder's words for a Stop on a card). */
export const PARK_STOPPED = "stopped by the owner";
/** The card kinds that wait inside a turn: their events' types. */
export const PARK_KINDS = Object.freeze(["permission", "question", "secret", "envchange"]);
/**
 * Where a permission card was asked, for the owner's No on it (each place answers a No in its own way): a step shown before
 * the card gets "Not run: you said no." under it (bash, a WebSocket monitor, web_search, the file tools and web_fetch); the
 * plan's card marks the call refused for its hooks; the others (a rule's card, Plan mode's card for Coder's other tools, a
 * connector's) only tell Coder.
 */
export const PARK_SITES = Object.freeze(["bash", "monitor", "web_search", "file", "tool", "connector", "plan", "question", "secret", "env"]);
export const STEP_SITES = Object.freeze(["bash", "monitor", "web_search", "file"]);
const FILE_TOOLS = new Set(["write", "edit", "read", "grep", "glob", "lsp", "web_fetch"]);
/** A permission card's place, from the card itself (askOwner's). */
export function siteOfCard(card) {
  const t = card && typeof card.tool === "string" ? card.tool : "";
  if (t === "plan") return "plan";
  if (t === "bash" || t === "powershell") return "bash";
  if (t === "monitor") return "monitor";
  if (t === "web_search") return "web_search";
  if (t === "connector") return "connector";
  if (FILE_TOOLS.has(t)) return "file";
  return "tool";
}

/** Thrown by the step that waits when its job pauses; Coder's loop ends the job there (runCoder). */
export class Parked {
  constructor(card) { this.card = card; }
}

const PID = /^p[0-9a-z]{2,24}$/;
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
/** The fields of a call that its checks and hooks set before its card, kept to take it up again (runCoder's `c`). */
const CALL_KEPT = ["hook", "ps", "monitor", "monitorArgs", "inputNote", "planFile", "planText", "rerun"];
export function keptCall(c) {
  const out = { id: String(c.id), name: String(c.name), args: c.args };
  for (const k of CALL_KEPT) if (c[k] !== undefined) out[k] = c[k];
  return out;
}

/** A paused job's record, checked (from the machine's end, Coder's Worker, or a job taking it up): the record, or null. */
export function parkRecord(x) {
  if (!isObj(x) || !PID.test(String(x.pid || "")) || !PARK_KINDS.includes(x.kind) || !PARK_SITES.includes(x.site)) return null;
  const c = x.call;
  if (!isObj(c) || typeof c.id !== "string" || !c.id || c.id.length > 200 || typeof c.name !== "string" || !c.name) return null;
  const ids = (Array.isArray(x.rest) ? x.rest : []).filter((y) => typeof y === "string" && y).slice(0, 100);
  return {
    pid: x.pid, kind: x.kind, site: x.site, call: c, rest: ids,
    mode: str(x.mode, 20), told: str(x.told, 20), rounds: Number.isInteger(x.rounds) && x.rounds >= 0 ? x.rounds : 0,
    notes: (Array.isArray(x.notes) ? x.notes : []).filter((n) => typeof n === "string").slice(0, 50),
    shown: (Array.isArray(x.shown) ? x.shown : []).filter((n) => typeof n === "string").slice(0, 200),
    ...(isObj(x.card) ? { card: x.card } : {}),
    // (Notes for Coder a job taking the turn up again held until the round's results were in, when it paused again first.)
    held: (Array.isArray(x.held) ? x.held : []).filter((m) => isObj(m) && m.role === "user" && typeof m.content === "string").slice(0, 20).map((m) => ({ role: "user", content: m.content.slice(0, 100_000), ...(m.appNote === true ? { appNote: true } : {}) })),
    at: Number(x.at) || 0,
  };
}

/** What the chat keeps of it beside the chat (meta.parked): which card waits, and since when. */
export function parkedMeta(record) {
  const r = parkRecord(record);
  return r ? { pid: r.pid, kind: r.kind, site: r.site, call: r.call.id, at: r.at } : null;
}
/** The card a chat's paused job waits on (meta.parked), or null. */
export function parkedOf(meta) {
  const p = meta && meta.parked;
  return isObj(p) && PID.test(String(p.pid || "")) && PARK_KINDS.includes(p.kind) ? p : null;
}

/**
 * THE OWNER'S ANSWER, AS THE CARD TAKES IT (what the machine's /answer takes for each kind, and an environment card's result
 * from Coder's server): the answer, or null when it is not one this card takes. Question picks are checked again where the
 * answers are read (the machine's questionPicks).
 */
export function parkAnswer(kind, a) {
  if (!isObj(a)) return null;
  const choice = String(a.choice || "");
  const comment = typeof a.comment === "string" ? a.comment.slice(0, 2000) : "";
  if (kind === "permission") {
    if (!["yes", "always", "auto", "acceptEdits", "no"].includes(choice)) return null;
    return { choice, comment, ...(typeof a.plan === "string" && (choice === "auto" || choice === "acceptEdits") ? { plan: a.plan.slice(0, 200_000) } : {}) };
  }
  if (kind === "question") {
    if (choice === "skip") return { choice };
    if (choice === "answers" && Array.isArray(a.picks)) return { choice, picks: a.picks.slice(0, 4) };
    if (choice === "chat" && typeof a.text === "string" && a.text.trim()) return { choice, text: a.text.slice(0, 100_000), qid: str(a.qid, 40) };
    return null;
  }
  if (kind === "secret") return choice === "saved" || choice === "no" ? { choice } : null;
  if (kind === "envchange") {
    if (choice === "no") return { choice };
    if ((choice === "approved" || choice === "refused") && typeof a.result === "string" && a.result) return { choice, result: a.result.slice(0, 4000) };
    return null;
  }
  return null;
}

/**
 * Whether a chat's saved conversation still ends on the paused call's round (the call and those after it have no result yet),
 * and where: { at, msg } (`at`: the assistant message's place), or null.
 */
export function parkedRound(messages, record) {
  const r = parkRecord(record);
  const list = Array.isArray(messages) ? messages : [];
  if (!r) return null;
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (!m || m.role !== "assistant" || !Array.isArray(m.tool_calls) || !m.tool_calls.length) continue;
    if (!m.tool_calls.some((tc) => tc && tc.id === r.call.id)) return null;
    const replied = new Set(list.slice(i + 1).filter((y) => y && y.role === "tool").map((y) => y.tool_call_id));
    return replied.has(r.call.id) ? null : { at: i, msg: m };
  }
  return null;
}

/**
 * THE CARD CLOSED WITHOUT ITS JOB (the owner's Stop, a Rewind or an Undo while it waited): the waiting call is told it was
 * stopped, as on a Stop while its job ran, and the round's calls after it that it held back get Claude Code's words for calls
 * a stop cancelled (NOT_NOW); every call then has its answer, as the AI's API needs. Answers the messages (unchanged when
 * they do not end on that round).
 */
export function closeParked(messages, record, said = PARK_STOPPED) {
  const r = parkRecord(record);
  const round = r ? parkedRound(messages, r) : null;
  if (!round) return Array.isArray(messages) ? messages : [];
  const replied = new Set(messages.slice(round.at + 1).filter((y) => y && y.role === "tool").map((y) => y.tool_call_id));
  const out = messages.slice();
  out.push({ role: "tool", tool_call_id: r.call.id, content: said });
  for (const tc of round.msg.tool_calls) if (tc && tc.id !== r.call.id && !replied.has(tc.id)) out.push({ role: "tool", tool_call_id: tc.id, content: NOT_NOW });
  return out;
}
/**
 * What the chat shows when Stop closes a paused card (`p`: its record, or the chat's meta.parked): its answer, the step's line
 * when it showed one ("Not run: stopped.", as on a Stop while its job ran), and the stop.
 */
export function stoppedEvents(p, at = Date.now()) {
  if (!isObj(p) || !PID.test(String(p.pid || ""))) return [];
  const callId = typeof p.call === "string" ? p.call : isObj(p.call) && typeof p.call.id === "string" ? p.call.id : "";
  return [
    { at, type: "permanswer", pid: p.pid, choice: "stop" },
    ...(STEP_SITES.includes(p.site) && callId ? [{ at, type: "result", id: callId, code: -1, ran: false, output: "Not run: stopped." }] : []),
    { at, type: "stopped" },
  ];
}
