/**
 * THE SECURITY SCAN, SAID BY THE MODEL (2026-10-23).
 *
 * Owner: /sentinel must be "like the user telling the model to start a
 * security check". So the offer (what the scan will check, and its price),
 * the line shown while it works, and the report are written by the reply
 * writer (`writeReply`, builder/site-reply.mjs) from facts read here — the
 * plan `planScan` sized from the site's own files and tables, the price, and
 * what the scan really found. These build the facts only; no sentence here
 * reaches the customer as written.
 *
 * Facts are `{ id, kind, text }`, the reply writer's own shape: it must
 * explain every one and list the ids it explained.
 */

import { PROGRESS_VOICE } from "./site-progress.mjs";

function list() {
  const out = [];
  const n = {};
  const PREFIX = { note: "n", pending: "p", money: "m", check: "k", changed: "c", "not-done": "f", unverified: "v" };
  return {
    add(kind, text) {
      const t = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
      if (!t) return;
      const p = PREFIX[kind] || "n";
      n[p] = (n[p] || 0) + 1;
      out.push({ id: p + n[p], kind, text: t });
    },
    out,
  };
}

const plural = (k, one, many) => k + " " + (k === 1 ? one : many);

/** What the scan will check and cost, before anything runs: the offer's facts. */
export function securityOfferFacts({ plan, credits } = {}) {
  const areas = plan && Array.isArray(plan.areas) ? plan.areas : [];
  const F = list();
  F.add("note", "They asked for a deep security check of their site. Nothing has been checked or charged yet; this reply offers the check.");
  if (!areas.length) {
    F.add("note", "Nothing on the site gives the check code or tables to read yet, so it would find little.");
  } else {
    const parts = areas.map((a) => a.title + " (" + plural(Number(a.checkers) || 1, "reviewer", "reviewers") + " to confirm each problem)");
    F.add("check", "Sized to this site's own files and tables, it will look at: " + parts.join("; ") + ".");
    F.add("check", "It reads the site's source code and its data rules; it never runs or changes anything on the site.");
  }
  const c = Number(credits);
  if (Number.isFinite(c) && c > 0) F.add("money", "It costs about " + plural(c, "credit", "credits") + " — the most it can charge; less if the checks use less.");
  else F.add("money", "It costs nothing or next to nothing for a site this size.");
  F.add("pending", "Nothing starts until they confirm with the button under this reply; \"Not now\" cancels at no cost.");
  return F.out;
}

/** The one line shown while the scan works. */
export function securityWorkingFacts({ plan } = {}) {
  const areas = plan && Array.isArray(plan.areas) ? plan.areas : [];
  const F = list();
  F.add("pending", "The security check is running now" + (areas.length ? " on: " + areas.map((a) => a.title).join(", ") : "") + ". It takes a minute or two.");
  return F.out;
}

/**
 * ONE STEP OF THE RUNNING SCAN, as facts for the progress talk (2026-10-23):
 * `deepScan`'s own `say(kind, data)` events — the areas it starts on, each
 * area as it finishes, how many possible problems it challenges, each
 * verdict. Null for an event it does not know.
 */
export function securityProgressFacts(kind, data) {
  const d = data && typeof data === "object" ? data : {};
  const F = list();
  if (kind === "hunt") F.add("pending", "The security check is looking for problems in: " + (Array.isArray(d.areas) && d.areas.length ? d.areas.join(", ") : "the site") + ".");
  else if (kind === "area") F.add("pending", "Finished looking at " + String(d.area || "one area") + (d.failed ? ": that look did not complete." : ": " + plural(Number(d.found) || 0, "possible problem", "possible problems") + " to double-check."));
  else if (kind === "challenge") F.add("pending", "Now double-checking " + plural(Number(d.candidates) || 0, "possible problem", "possible problems") + ", each by separate reviewers.");
  else if (kind === "verdict") F.add("pending", "Reviewed \"" + String(d.title || "a possible problem") + "\": " + (d.verdict === "confirmed" ? "confirmed as a real problem" : d.verdict === "rejected" ? "not a real problem" : "could not be settled from the code") + ".");
  else return null;
  return F.out;
}

/** What the scan found, after it ran: the report's facts. */
export function securityReportFacts(report) {
  const F = list();
  if (!report || typeof report !== "object") {
    F.add("not-done", "The security check could not run just now. Nothing was charged for it.");
    return F.out;
  }
  const found = Array.isArray(report.findings) ? report.findings : [];
  const unsure = Array.isArray(report.unsure) ? report.unsure : [];
  if (!found.length) F.add("check", "The check found no problems on the site.");
  else {
    F.add("check", "The check found " + plural(found.length, "thing", "things") + " to look at.");
    for (const f of found.slice(0, 3)) F.add("check", (f && f.severity ? String(f.severity) + ": " : "") + String((f && f.title) || "a problem"));
  }
  if (unsure.length) F.add("unverified", unsure.length + " more could not be settled from the code alone.");
  F.add("note", "The full report, with a Fix it button for each problem, is under More → Security.");
  const cost = Number(report.cost);
  if (Number.isFinite(cost) && cost > 0) F.add("money", "The check used " + plural(cost, "credit", "credits") + ".");
  return F.out;
}

/**
 * THE RULE EVERY LINE SHOWN WHILE THE SCAN RUNS IS WRITTEN UNDER (2026-10-23,
 * the owner's voice for progress talk, `PROGRESS_VOICE`): one short line, a
 * professional speaking to a client, first person without "I" as the opener,
 * something new each time, nothing repeated from the lines before.
 */
export const SCAN_LINE_RULE =
  "WRITE ONE SHORT LINE, UNDER 120 CHARACTERS, SHOWN WHILE THE CHECK RUNS.\n" +
  "Each line is one of a series the customer reads as the check goes on: say only this step's news, and never repeat a tail such as how long it takes or that nothing on the site changes.\n\n" +
  PROGRESS_VOICE;

/** The rule for one scan line, with the lines already shown so the next says only what is new. */
export function scanLineRule(earlier = []) {
  const said = (Array.isArray(earlier) ? earlier : []).filter((l) => typeof l === "string" && l.trim()).map((l) => "- " + l.replace(/\s+/g, " ").trim());
  return SCAN_LINE_RULE + (said.length ? "\nTHE LINES ALREADY SHOWN, IN ORDER (never repeat them):\n" + said.join("\n") : "");
}
