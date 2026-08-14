/** Music production: tempo, dynamics, tone, image and loudness. */

import { inkOn } from "./_ink";

/** The ribbon's alternating tone, as a fill percentage. */
const chordPct = (i: number) => Math.round((0.45 + (i % 3) * 0.2) * 100);

const TONE = "var(--foreground)";

/* ----------------------------------------------------------------------- tempo map */
/**
 * Tempo across a piece, with the RANGE stated.
 *
 * A performance that varies by ten beats a minute is expressive; one that
 * varies by two is metronomic, and the difference is invisible without the
 * span written down.
 */
export function TempoMap({
  points, height = 220, label,
}: {
  points: { bar: number; bpm: number; marking?: string }[]; height?: number; label?: string;
}) {
  if (points.length < 2) return null;
  const bpms = points.map((p) => p.bpm);
  const lo = Math.min(...bpms), hi = Math.max(...bpms);
  const pad = (hi - lo) * 0.2 || 2;
  const maxBar = Math.max(...points.map((p) => p.bar));
  const x = (b: number) => (b / maxBar) * 100;
  const y = (v: number) => 100 - ((v - lo + pad) / (hi - lo + pad * 2)) * 100;
  const mean = bpms.reduce((a, b) => a + b, 0) / bpms.length;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `${lo} to ${hi} bpm`}>
        <line x1={0} y1={y(mean)} x2={100} y2={y(mean)} stroke={TONE} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.45} vectorEffect="non-scaling-stroke" />
        <polyline points={points.map((p) => `${x(p.bar)},${y(p.bpm)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={2.2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <div className="relative mt-1 h-3.5">
        {points.filter((p) => p.marking).map((p) => (
          <span key={p.bar} className="absolute -translate-x-1/2 text-[9px] text-muted-foreground"
            style={{ left: `${Math.min(93, Math.max(7, x(p.bar)))}%` }}>{p.marking}</span>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>bar 1</span><span>bar {maxBar}</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {lo}–{hi} bpm around a mean of {mean.toFixed(1)} — a span of {hi - lo},
        {hi - lo < 4 ? " which is essentially metronomic" : " which is a genuinely elastic performance"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ dynamics curve */
/**
 * Level over a piece with the marked dynamics, and the actual RANGE in dB —
 * a score that says pp to ff and a performance that spans six decibels are
 * not the same piece.
 */
export function DynamicsCurve({
  points, marks = [], height = 230, label,
}: {
  points: { bar: number; db: number }[]; marks?: { bar: number; dynamic: string }[];
  height?: number; label?: string;
}) {
  if (points.length < 2) return null;
  const dbs = points.map((p) => p.db);
  const lo = Math.min(...dbs) - 3, hi = Math.max(...dbs) + 3;
  const maxBar = Math.max(...points.map((p) => p.bar));
  const x = (b: number) => (b / maxBar) * 100;
  const y = (v: number) => 100 - ((v - lo) / (hi - lo)) * 100;
  const range = Math.max(...dbs) - Math.min(...dbs);

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `${range.toFixed(1)} dB range`}>
        <polygon points={`0,100 ${points.map((p) => `${x(p.bar)},${y(p.db)}`).join(" ")} 100,100`} fill={TONE} fillOpacity={0.14} />
        <polyline points={points.map((p) => `${x(p.bar)},${y(p.db)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {marks.map((m) => (
          <line key={m.bar} x1={x(m.bar)} y1={0} x2={x(m.bar)} y2={100}
            stroke={TONE} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="relative mt-1 h-3.5">
        {marks.map((m) => (
          <span key={m.bar} className="absolute -translate-x-1/2 text-[10px] italic"
            style={{ left: `${Math.min(94, Math.max(6, x(m.bar)))}%` }}>{m.dynamic}</span>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        {range.toFixed(1)} dB between the quietest and loudest moment ·
        {range < 12 ? " a narrow range for a score marked this way" : " a genuinely wide dynamic range"}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- EQ curve */
/**
 * Gain against frequency on a log axis, which is the only axis that matches
 * how hearing works — an octave is the same distance everywhere.
 */
export function EqCurve({
  bands, height = 240, label,
}: {
  bands: { hz: number; gainDb: number; q: number }[]; height?: number; label?: string;
}) {
  if (!bands.length) return null;
  const F0 = 20, F1 = 20000;
  const px = (f: number) => ((Math.log10(f) - Math.log10(F0)) / (Math.log10(F1) - Math.log10(F0))) * 100;
  const N = 240;
  const curve = Array.from({ length: N + 1 }, (_, i) => {
    const f = F0 * Math.pow(F1 / F0, i / N);
    // Sum of bell curves in log-frequency, which is how a parametric EQ behaves.
    const g = bands.reduce((s, b) => {
      const d = (Math.log2(f) - Math.log2(b.hz)) * b.q;
      return s + b.gainDb * Math.exp(-d * d);
    }, 0);
    return { f, g };
  });
  const maxG = Math.max(12, ...curve.map((c) => Math.abs(c.g))) * 1.1;
  const y = (g: number) => 50 - (g / maxG) * 50;
  const boosted = bands.filter((b) => b.gainDb > 0), cut = bands.filter((b) => b.gainDb < 0);

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `${bands.length} bands`}>
        {[100, 1000, 10000].map((f) => (
          <line key={f} x1={px(f)} y1={0} x2={px(f)} y2={100} stroke={TONE} strokeWidth={1} strokeOpacity={0.14} vectorEffect="non-scaling-stroke" />
        ))}
        <line x1={0} y1={50} x2={100} y2={50} stroke={TONE} strokeWidth={1} strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />
        <polyline points={curve.map((c) => `${px(c.f)},${y(c.g)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={2.2} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>20 Hz</span><span>100</span><span>1k</span><span>10k</span><span>20k</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Log frequency, so an octave is the same width everywhere · ±{maxG.toFixed(0)} dB shown ·
        {boosted.length} boost{boosted.length === 1 ? "" : "s"}, {cut.length} cut{cut.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------- stereo field */
/**
 * Where each element sits left to right and how wide it is.
 *
 * MONO COMPATIBILITY is the thing that bites: anything very wide partly
 * cancels when summed, so width is drawn and the risk is named.
 */
export function StereoField({
  elements, height = 250, label,
}: {
  /** pan −1 to 1, width 0 (mono) to 1 (fully wide) */
  elements: { name: string; pan: number; width: number; level: number }[]; height?: number; label?: string;
}) {
  if (!elements.length) return null;
  const wide = elements.filter((e) => e.width > 0.75);
  const maxLevel = Math.max(...elements.map((e) => e.level));

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <div className="absolute inset-0 flex flex-col justify-around">
          {elements.map((e) => {
            const from = Math.max(0, ((e.pan + 1) / 2 - e.width / 2) * 100);
            const to = Math.min(100, ((e.pan + 1) / 2 + e.width / 2) * 100);
            return (
              <div key={e.name} className="relative h-5">
                <span className="absolute top-1 bottom-1 rounded-full" style={{
                  left: `${from}%`, width: `${Math.max(1.5, to - from)}%`,
                  background: TONE, opacity: 0.3 + (e.level / maxLevel) * 0.7,
                }} title={`${e.name}: pan ${e.pan.toFixed(2)}, width ${e.width.toFixed(2)}`} />
                {/* A very wide source leaves no track outside itself, so a label
                    parked past its end runs off the card — the widest elements are
                    exactly the ones worth labelling. Below that margin the name
                    goes INSIDE the bar instead. */}
                {(((e.pan + 1) / 2) > 0.5 ? from : 100 - to) < 16 ? (
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-1 text-[9px] whitespace-nowrap"
                    style={{ color: inkOn(Math.round((e.level / maxLevel) * 92)) }}>{e.name}</span>
                ) : (
                  <span className="absolute top-1/2 -translate-y-1/2 text-[9px] whitespace-nowrap text-muted-foreground"
                    style={((e.pan + 1) / 2) > 0.5 ? { right: `${100 - from + 1.5}%` } : { left: `${to + 1.5}%` }}>{e.name}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="pointer-events-none absolute top-0 bottom-0 w-px" style={{ left: "50%", background: TONE, opacity: 0.4 }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>L</span><span>centre</span><span>R</span>
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Bar length is stereo width, darkness is level ·
        {wide.length ? ` ${wide.map((e) => e.name).join(", ")} very wide — check what survives a mono sum` : " nothing wide enough to worry about in mono"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- loudness range */
/**
 * Integrated loudness and range against a delivery target.
 *
 * A track over the platform's target gets turned DOWN, so mastering louder
 * than it buys nothing and costs dynamic range — the penalty is computed.
 */
export function LoudnessRange({
  tracks, targetLufs, height = 240, label,
}: {
  tracks: { name: string; lufs: number; lra: number; truePeakDb: number }[]; targetLufs: number;
  height?: number; label?: string;
}) {
  if (!tracks.length) return null;
  const rows = tracks.map((t) => ({ ...t, penalty: Math.min(0, targetLufs - t.lufs) }));
  const lo = Math.min(targetLufs, ...rows.map((r) => r.lufs)) - 3;
  const hi = Math.max(targetLufs, ...rows.map((r) => r.lufs)) + 3;
  const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const turnedDown = rows.filter((r) => r.penalty < 0);
  const clipping = rows.filter((r) => r.truePeakDb > -1);

  return (
    <div className="w-full space-y-1.5" style={{ minHeight: height }}>
      {rows.map((r) => (
        <div key={r.name}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-medium">{r.name}</span>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.lufs} LUFS · LRA {r.lra} · peak {r.truePeakDb} dBTP
              {r.penalty < 0 ? ` · turned down ${Math.abs(r.penalty).toFixed(1)}` : ""}
            </span>
          </div>
          <div className="relative mt-0.5 h-4 rounded-[2px]" style={{ background: "var(--muted)" }}>
            <span className="absolute top-0 bottom-0 rounded-[2px]" style={{
              left: `${pos(r.lufs - r.lra / 2)}%`, width: `${(r.lra / (hi - lo)) * 100}%`,
              background: TONE, opacity: 0.3,
            }} />
            <span className="absolute top-[-2px] bottom-[-2px] w-[3px] -translate-x-1/2 rounded-[1px]"
              style={{ left: `${pos(r.lufs)}%`, background: TONE }} />
            <span className="absolute top-[-3px] bottom-[-3px] w-px" style={{ left: `${pos(targetLufs)}%`, background: TONE }} />
          </div>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Thin line is the {targetLufs} LUFS target, the block is the loudness range ·
        {turnedDown.length ? ` ${turnedDown.length} will be turned down on playback, which buys nothing` : " nothing gets turned down"}
        {clipping.length ? ` · ${clipping.map((r) => r.name).join(", ")} peaking above −1 dBTP` : ""}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- chord ribbon */
/**
 * A progression as a ribbon, with each chord's function.
 *
 * The same four chords in a different order are a different progression, so
 * width is DURATION and the sequence is the shape.
 */
export function ChordRibbon({
  chords, musicalKey: keyName, label,
}: {
  chords: { symbol: string; beats: number; degree?: string }[];
  /** NOT named `key` — React reserves that, so the prop would never arrive */
  musicalKey?: string; label?: string;
}) {
  if (!chords.length) return null;
  const total = chords.reduce((s, c) => s + c.beats, 0);
  const unique = new Set(chords.map((c) => c.symbol)).size;

  return (
    <div className="w-full">
      <div className="flex h-12 overflow-hidden rounded-[3px]">
        {chords.map((c, i) => (
          <div key={i} className="flex flex-col items-center justify-center overflow-hidden"
            style={{
              width: `${(c.beats / total) * 100}%`,
              // The alternating tone rides in the FILL, not in element opacity:
              // opacity fades the label with the block, so a pale bar carried
              // pale white text (measured 3.27:1). As a percentage the ink can
              // be chosen for the tone that results.
              background: `color-mix(in oklch, ${TONE} ${chordPct(i)}%, transparent)`,
              borderRight: "1px solid var(--background)",
            }} title={`${c.symbol} · ${c.beats} beats`}>
            <span className="text-[11px] font-semibold leading-none" style={{ color: inkOn(chordPct(i)) }}>{c.symbol}</span>
            {c.degree ? <span className="text-[8px] leading-tight" style={{ color: inkOn(chordPct(i)) }}>{c.degree}</span> : null}
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        {keyName ? `In ${keyName} · ` : ""}{total} beats, {chords.length} changes over {unique} distinct chords ·
        width is duration, so a chord held for a bar looks like one
      </p>
    </div>
  );
}
