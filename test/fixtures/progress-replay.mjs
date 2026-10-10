// THE LINES A RECORD'S MILESTONES WOULD BE WRITTEN AS (2026-10-10), replayed
// through the real writer functions, for a case whose harness ends the job
// before a queued writer task is delivered (see `replayLines`).
import assert from "node:assert/strict";
import { openRecord, appendMark, claimWriter, batchFor, commitLine, progressContext, progressRequest } from "../../builder/site-progress.mjs";

/**
 * THE LINES AS THE WRITER WOULD BE ASKED FOR THEM, FROM THE ROUTE'S OWN
 * MILESTONES. In this harness the job runs to its end before a queued writer
 * task is delivered, so its record is closed with every milestone set aside
 * and no line written. So the route's real milestones are replayed, in order,
 * into a fresh record, through the functions the Worker's writer calls
 * (`writeProgressLine`: `claimWriter`, `batchFor`, `progressContext`,
 * `progressRequest`, `commitLine`), a line written after every `every`
 * milestones — none straight after a stage in `skip`, so its facts share the
 * next line's batch. Answers each request's whole text, in order.
 */
export function replayLines(rec, { every = 1, skip = [] } = {}) {
  let r = openRecord({ job: rec.job, uid: rec.uid, slug: rec.slug, op: rec.op, run: "replay", words: rec.words, pages: rec.pages, at: 1 });
  const texts = [];
  let t = 10;
  const write = () => {
    if (!batchFor(r).marks.length) return;
    const c = claimWriter(r, "w", t);
    assert.ok(c && c.rec, "the replay could not claim the writer");
    r = c.rec;
    const batch = batchFor(r);
    if (!batch.facts.length) return;
    const req = progressRequest({ facts: batch.facts, context: progressContext(r), model: "m" });
    texts.push(req.messages[0].content);
    r = commitLine(r, { owner: "w", marks: batch.marks, text: "LINE " + texts.length, now: t + 1 });
    assert.ok(r, "the replay's line was not committed");
  };
  rec.marks.forEach((m, i) => {
    t += 10;
    r = appendMark(r, { stage: m.stage, facts: m.facts.map(({ state, text }) => ({ state, text })), at: t }).rec;
    if ((i + 1) % every === 0 && !skip.includes(m.stage)) write();
  });
  write();
  return { texts, rec: r };
}
/** The request that hands over the not-made fact (by its text), and every request after it. */
export function afterNotMade(texts, notMade) {
  const at = texts.findIndex((x) => x.includes("(notdone) " + notMade.text));
  return { at, later: at < 0 ? [] : texts.slice(at + 1) };
}

