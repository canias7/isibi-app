// Draws the design step and the generate step of ONE build on ONE shared time
// axis, in the convention design-graph-sowerby.png set: bars at their real start
// offsets, green for the critical path ending exactly on the wall's rule, the
// groups named, the findings in prose underneath.
//
// Every number here is read off site_builds.steps for saltmarsh-kayak-co-2 and
// each panel's parts sum to its own agentMs exactly, which is the check that the
// figures on the page are the figures in the row.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright-core";

const OUT = process.argv[2] || "/tmp/chart.png";

/* ── the build ─────────────────────────────────────────────────────────────── */

const SLUG = "saltmarsh-kayak-co-2";
const DATE = "2026-09-11";

// design: waveMs 393,200 · agentMs 870,446 · 16 agents
const design = {
  wave: 393200, agent: 870446,
  groups: [
    { label: "THE CRITICAL PATH", rows: [
      { name: "components", ms: 73913, at: 0, tone: "green" },
      { name: "shape", dep: "components", ms: 168536, at: 73913, tone: "green" },
      { name: "behavior", dep: "shape", ms: 150751, at: 242449, tone: "green" },
    ]},
    { label: "THE OTHER TWO CHAINS", rows: [
      { name: "theme", ms: 28787, at: 0, tone: "mid" },
      { name: "css", dep: "theme", ms: 47247, at: 28787, tone: "mid" },
      { name: "identity", ms: 40096, at: 0, tone: "mid" },
      { name: "wordmark", dep: "identity", ms: 24991, at: 40096, tone: "mid" },
    ]},
    { label: "THE NINE THAT WAIT FOR NOTHING", rows: [
      { name: "favicon", ms: 77488, at: 0, tone: "pale" },
      { name: "images", ms: 55833, at: 0, tone: "pale" },
      { name: "extras", ms: 42014, at: 0, tone: "pale" },
      { name: "purpose", ms: 41750, at: 0, tone: "pale" },
      { name: "web", ms: 39012, at: 0, tone: "pale" },
      { name: "action", ms: 25007, at: 0, tone: "pale" },
      { name: "lang", ms: 24780, at: 0, tone: "pale" },
      { name: "pages", ms: 17342, at: 0, tone: "pale" },
      { name: "kind", ms: 12899, at: 0, tone: "pale" },
    ]},
  ],
};

// generate: waveMs 381,833 · agentMs 1,020,752 · 8 bands + 1 part
// p1 is the NINTH request against a container that holds eight, so it waited for
// the first permit to free — b7's, at 33,860 — and started at 33,965.
const generate = {
  wave: 381833, agent: 1020752,
  groups: [
    { label: "THE CRITICAL PATH — A BAND, THEN THE QUEUE", rows: [
      { name: "b7", note: "the shortest band", ms: 33860, at: 0, tone: "green" },
      { name: "p1", note: "the tide chart", dep: "a free socket", ms: 347868, at: 33965, tone: "green", wait: 33965 },
    ]},
    { label: "THE EIGHT BANDS — ALL AT ONCE, NOTHING WAITING", rows: [
      { name: "b3", ms: 146980, at: 0, tone: "mid" },
      { name: "b1", ms: 124013, at: 0, tone: "mid" },
      { name: "b4", ms: 108581, at: 0, tone: "mid" },
      { name: "b2", ms: 78990, at: 0, tone: "pale" },
      { name: "b6", ms: 67571, at: 0, tone: "pale" },
      { name: "b5", ms: 56881, at: 0, tone: "pale" },
      { name: "b8", ms: 56008, at: 0, tone: "pale" },
    ]},
  ],
};

/* ── the check that the picture is the row ─────────────────────────────────── */

const sum = (p) => p.groups.flatMap((g) => g.rows).reduce((n, r) => n + r.ms, 0);
for (const [name, panel] of [["design", design], ["generate", generate]]) {
  const got = sum(panel);
  if (got !== panel.agent) {
    throw new Error(`${name}: parts sum to ${got}, agentMs is ${panel.agent} — the chart is not the row`);
  }
}

/* ── geometry ──────────────────────────────────────────────────────────────── */

const AXIS_MAX = 440000;           // 440s, leaving room for the comparison rule
const PLOT_W = 1150;
const LABEL_W = 175;
const x = (ms) => (ms / AXIS_MAX) * PLOT_W;
const n = (v) => v.toLocaleString("en-GB");

const TONE = { green: "#00bf4d", mid: "#a8a093", pale: "#cec8bb" };

function rowHTML(r) {
  const left = x(r.at), w = Math.max(x(r.ms), 2);
  const inside = w > 66;
  const dep = r.dep ? `<span class="dep">← ${r.dep}</span>` : "";
  const note = r.note ? `<span class="note">${r.note}</span>` : "";
  // the wait is drawn as the gap: a hairline from 0 to where the bar starts, so
  // the queue is visible as distance rather than asserted in a caption.
  const wait = r.wait
    ? `<div class="wait" style="left:0;width:${x(r.wait)}px"><span>waited ${n(r.wait)}</span></div>`
    : "";
  return `<div class="row">
    <div class="lab">${r.name}${note}${dep}</div>
    <div class="track">${wait}
      <div class="bar ${r.tone}" style="left:${left}px;width:${w}px">
        ${inside ? `<span class="in">${n(r.ms)}</span>` : ""}
      </div>
      ${inside ? "" : `<span class="out" style="left:${left + w + 8}px">${n(r.ms)}</span>`}
    </div>
  </div>`;
}

function panelHTML(panel, rules) {
  const body = panel.groups.map((g) =>
    `<div class="glab">${g.label}</div>` + g.rows.map(rowHTML).join("")
  ).join("");
  // Each rule's label gets its own tier, because two rules 34 px apart put two
  // sentences on one line and neither can be read. `side: "left"` hangs the
  // label off the rule's left so a mark near the axis end cannot overflow.
  const marks = rules.map((r, i) => {
    const top = -4 + (r.tier ?? i) * 17;
    const pos = r.side === "left"
      ? `right:${PLOT_W - x(r.at) + 7}px;text-align:right`
      : `left:${x(r.at) + 7}px`;
    return `<div class="rule ${r.kind}" style="left:${x(r.at)}px"></div>
     <div class="rlab ${r.kind}" style="${pos};top:${top}px">${r.text}</div>`;
  }).join("");
  return `<div class="panel"><div class="rules">${marks}</div>${body}</div>`;
}

const ticks = [];
for (let s = 0; s <= 420; s += 60) ticks.push(s);

const html = `<style>
  @page { margin: 0 }
  body { margin: 0; background: #f2efe9; color: #2b2a26;
         font: 14px Georgia, "Times New Roman", serif; }
  .sheet { padding: 40px 46px 34px; width: ${LABEL_W + PLOT_W + 60}px; }
  h1 { font: bold 27px Georgia, serif; margin: 0 0 10px; letter-spacing: -0.2px; }
  .sub { font-size: 14.5px; color: #55514a; margin: 0 0 4px; line-height: 1.5; }
  .sub b { color: #2b2a26; }
  .axisnote { font-style: italic; font-size: 12.5px; color: #8d877c; margin: 0 0 26px; }

  .steph { font: 13px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
           letter-spacing: .07em; color: #3c3830; margin: 26px 0 3px; }
  .steps { font-size: 13px; color: #7a746a; margin: 0 0 12px; }

  .panel { position: relative; }
  .rules { position: absolute; left: ${LABEL_W}px; top: -4px; bottom: -6px; width: ${PLOT_W}px; }
  .rule { position: absolute; top: 0; bottom: 0; width: 2px; }
  .rule.wall { background: #00bf4d; }
  .rule.ghost { background: #cdc6b8; width: 1px; }
  .rlab { position: absolute; white-space: nowrap;
          font: 12.5px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; }
  .rlab.wall { color: #00a343; }
  .rlab.ghost { color: #99938a; }

  .glab { font: 11px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
          letter-spacing: .09em; color: #a39d92; margin: 16px 0 7px ${LABEL_W}px; }
  .row { display: flex; align-items: center; height: 25px; }
  .lab { width: ${LABEL_W - 12}px; padding-right: 12px; text-align: right;
         font-size: 14.5px; white-space: nowrap; }
  .dep, .note { font-size: 11px; color: #a39d92; margin-left: 5px;
                font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; }
  .track { position: relative; width: ${PLOT_W}px; height: 25px; }
  .bar { position: absolute; top: 3px; height: 19px; border-radius: 2px; }
  .bar.green { background: #00bf4d } .bar.mid { background: #a8a093 } .bar.pale { background: #cec8bb }
  .in, .out { position: absolute; top: 4px; font: 11.5px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
              font-variant-numeric: tabular-nums; }
  .in { left: 7px; color: #fff; } .bar.pale .in { color: #6f6a60 }
  .out { color: #6b665c; }
  .wait { position: absolute; top: 12px; height: 1px; background: repeating-linear-gradient(
            to right, #b9b2a5 0 4px, transparent 4px 8px); }
  .wait span { position: absolute; right: 6px; top: -16px; white-space: nowrap;
               font: 10.5px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #99938a; }

  .axis { position: relative; margin-left: ${LABEL_W}px; width: ${PLOT_W}px;
          height: 26px; border-top: 1px solid #d5cfc3; margin-top: 10px; }
  .tick { position: absolute; top: 7px; transform: translateX(-50%);
          font: 11.5px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #8d877c; }

  hr { border: 0; border-top: 1px solid #d5cfc3; margin: 26px 0 16px; }
  hr.dot { border-top: 1px dashed #d5cfc3; margin: 14px 0; }
  .f { font-size: 14.5px; line-height: 1.62; color: #55514a; margin: 0 0 7px; }
  .f b { color: #2b2a26; }
</style>

<div class="sheet">
  <h1>Design and generate — ${SLUG}, ${DATE}</h1>
  <p class="sub">The design ran as <b>sixteen agents</b> and took <b>393,200 ms</b>.
     The page was written as <b>nine agents</b> — eight bands and one part — and took
     <b>381,833 ms</b>. Nine pieces against a container that holds eight, so one queued.</p>
  <p class="axisnote">Both panels share one axis. It is time WITHIN each step, not wall clock of the build — the generate step follows the design.</p>

  <div class="steph">THE DESIGN STEP — 16 agents, twelve start at once · waveMs 393,200 · agentMs 870,446</div>
  <div class="steps">The green run is the critical path — components → shape → behavior — and it is the whole step, to the millisecond.</div>
  ${panelHTML(design, [
    { at: 393200, kind: "wall", text: "393,200 — the design step ends" },
  ])}

  <div class="steph">THE GENERATE STEP — 8 bands + 1 part · waveMs 381,833 · agentMs 1,020,752</div>
  <div class="steps">The green run is a band and then the part that waited for its socket. The gap in front of p1 is the queue.</div>
  ${panelHTML(generate, [
    { at: 347868, kind: "ghost", tier: 1, side: "left", text: "347,868 — the slowest piece ends" },
    { at: 381833, kind: "wall",  tier: 0, text: "381,833 — the fan-out ends" },
    { at: 407694, kind: "ghost", tier: 2, text: "407,694 — this same shape in ONE call (ben-crowe)" },
  ])}

  <div class="axis">${ticks.map((s) =>
    `<div class="tick" style="left:${x(s * 1000)}px">${s}s</div>`).join("")}</div>

  <hr>
  <p class="f"><b>Both panels' parts sum to their whole.</b> Sixteen design agents = 870,446 ms = agentMs exactly; nine page agents = 1,020,752 ms = agentMs exactly.</p>
  <p class="f"><b>The design's critical path is the step.</b> 73,913 + 168,536 + 150,751 = 393,200 = waveMs exactly. Three builds running, the same three links. Overlap <b>477,246 ms</b>.</p>
  <hr class="dot">
  <p class="f"><b>The generate step's wall is LONGER than anything in it — 381,833 against a slowest piece of 347,868.</b> That is impossible without a queue, and it is the first time this platform has drawn one. Nine pieces, eight sockets: p1 was sent last, waited <b>33,965 ms</b> for the first permit to free, and the band that freed it was b7 at <b>33,860</b>. The two are 105 ms apart.</p>
  <p class="f"><b>p1's bar measures its own run, not its wait</b> — the clock starts after the permit. Were it otherwise the queue would flatter itself: every waiter would be charged for the calls ahead of it and the overlap would grow with the queue rather than with the work.</p>
  <p class="f"><b>Overlap: 638,919 ms.</b> Seventeen minutes of page writing in six and a half minutes of clock — the largest this platform has measured.</p>
  <hr class="dot">
  <p class="f"><b>And the split bought almost nothing, because the part is the wall.</b> ben-crowe-guitar was this same nine-piece shape, refused as <i>bands:wide</i> and written in ONE call at 407,694 ms — the faint line on the right. This one split and took 390,123 end to end: <b>17,571 ms saved, about 3%</b>. All eight bands were done inside 147 s; the tide chart alone took 348 s and started 34 s late. A fan-out cannot beat its slowest piece, so more sockets buy nothing here — only a faster part would.</p>
</div>`;

const file = path.join(os.tmpdir(), path.basename(OUT).replace(/\.png$/, "") + ".html");
fs.writeFileSync(file, html);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: LABEL_W + PLOT_W + 152, height: 1400 }, deviceScaleFactor: 2 });
await page.goto("file://" + file);
await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
console.log("wrote " + OUT);
