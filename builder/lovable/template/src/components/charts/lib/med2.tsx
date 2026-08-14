/** Clinical charts — the ones drawn on paper in a consulting room. */

import { inkOn } from "./_ink";

const TONE = "var(--foreground)";

/* --------------------------------------------------------------- pedigree */
/**
 * A family tree in genetics notation: square male, circle female, filled
 * affected, and the PROBAND marked with an arrow.
 *
 * Shape and fill carry sex and status independently, so neither depends on
 * colour — which is the convention precisely because these get photocopied.
 */
export function PedigreeChart({
  people, size = 340, label,
}: {
  people: { id: string; sex: "m" | "f" | "u"; affected?: boolean; carrier?: boolean; proband?: boolean; generation: number; order: number; parents?: [string, string] }[];
  size?: number; label?: string;
}) {
  if (!people.length) return null;
  const gens = Math.max(...people.map((p) => p.generation)) + 1;
  const perGen = new Map<number, number>();
  people.forEach((p) => perGen.set(p.generation, Math.max(perGen.get(p.generation) ?? 0, p.order + 1)));
  const at = (p: { generation: number; order: number }) => ({
    x: ((p.order + 0.5) / (perGen.get(p.generation) || 1)) * 100,
    y: ((p.generation + 0.5) / gens) * 100,
  });
  const byId = new Map(people.map((p) => [p.id, p]));
  const affected = people.filter((p) => p.affected).length;
  const R = 4.2;

  return (
    <div className="w-full">
      <svg viewBox="-4 -4 108 108" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${people.length} people, ${affected} affected`}>
        {people.filter((p) => p.parents).map((p) => {
          const [a, b] = p.parents!;
          const pa = byId.get(a), pb = byId.get(b);
          if (!pa || !pb) return null;
          const A = at(pa), B = at(pb), C = at(p);
          const mid = { x: (A.x + B.x) / 2, y: A.y };
          return (
            <g key={`e-${p.id}`}>
              <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={TONE} strokeWidth={0.6} />
              <line x1={mid.x} y1={mid.y} x2={mid.x} y2={(mid.y + C.y) / 2} stroke={TONE} strokeWidth={0.6} />
              <line x1={mid.x} y1={(mid.y + C.y) / 2} x2={C.x} y2={(mid.y + C.y) / 2} stroke={TONE} strokeWidth={0.6} />
              <line x1={C.x} y1={(mid.y + C.y) / 2} x2={C.x} y2={C.y} stroke={TONE} strokeWidth={0.6} />
            </g>
          );
        })}
        {people.map((p) => {
          const c = at(p);
          const fill = p.affected ? TONE : "var(--background)";
          return (
            <g key={p.id}>
              {p.sex === "f" ? (
                <circle cx={c.x} cy={c.y} r={R} fill={fill} stroke={TONE} strokeWidth={0.9} />
              ) : p.sex === "m" ? (
                <rect x={c.x - R} y={c.y - R} width={R * 2} height={R * 2} fill={fill} stroke={TONE} strokeWidth={0.9} />
              ) : (
                <polygon points={`${c.x},${c.y - R * 1.2} ${c.x + R * 1.2},${c.y} ${c.x},${c.y + R * 1.2} ${c.x - R * 1.2},${c.y}`} fill={fill} stroke={TONE} strokeWidth={0.9} />
              )}
              {p.carrier && !p.affected ? <circle cx={c.x} cy={c.y} r={1.3} fill={TONE} /> : null}
              {p.proband ? (
                <g>
                  <line x1={c.x - R - 5} y1={c.y + R + 5} x2={c.x - R - 1} y2={c.y + R + 1} stroke={TONE} strokeWidth={0.9} />
                  <polygon points={`${c.x - R - 1},${c.y + R + 1} ${c.x - R - 3.4},${c.y + R + 1.6} ${c.x - R - 1.6},${c.y + R + 3.4}`} fill={TONE} />
                </g>
              ) : null}
              <text x={c.x} y={c.y + R + 4} fontSize={2.8} textAnchor="middle" className="fill-muted-foreground">{p.id}</text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        □ male · ○ female · ◇ unknown · filled affected · centre dot carrier · arrow marks the proband ·
        {affected} of {people.length} affected
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- hypnogram */
/**
 * A night of sleep by stage.
 *
 * Stages are stacked in physiological order with REM ABOVE deep sleep, and the
 * time in each is measured off the same blocks the chart draws.
 */
export function Hypnogram({
  epochs, minutesPerEpoch = 0.5, height = 200, label,
}: {
  epochs: ("wake" | "rem" | "n1" | "n2" | "n3")[]; minutesPerEpoch?: number; height?: number; label?: string;
}) {
  if (!epochs.length) return null;
  const ORDER = ["wake", "rem", "n1", "n2", "n3"] as const;
  const LABEL = { wake: "Wake", rem: "REM", n1: "N1", n2: "N2", n3: "N3 deep" };
  const rowY = (s: (typeof ORDER)[number]) => (ORDER.indexOf(s) / (ORDER.length - 1)) * 88 + 6;
  const x = (i: number) => (i / epochs.length) * 100;
  const mins = (s: string) => Math.round(epochs.filter((e) => e === s).length * minutesPerEpoch);
  const total = epochs.length * minutesPerEpoch;
  const asleep = epochs.filter((e) => e !== "wake").length * minutesPerEpoch;

  return (
    <div className="w-full">
      <div className="flex">
        <div className="flex flex-col justify-between pr-1.5 text-[9px] text-muted-foreground" style={{ height, paddingTop: height * 0.045, paddingBottom: height * 0.055 }}>
          {ORDER.map((s) => <span key={s}>{LABEL[s]}</span>)}
        </div>
        <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
          role="img" aria-label={label ?? `${Math.round(asleep)} minutes asleep of ${total}`}>
          {ORDER.map((s) => (
            <line key={s} x1={0} y1={rowY(s)} x2={100} y2={rowY(s)} stroke={TONE} strokeWidth={1} strokeOpacity={0.14} vectorEffect="non-scaling-stroke" />
          ))}
          <polyline points={epochs.flatMap((e, i) => [`${x(i)},${rowY(e)}`, `${x(i + 1)},${rowY(e)}`]).join(" ")}
            fill="none" stroke={TONE} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
          {epochs.map((e, i) => e === "rem" ? (
            <rect key={i} x={x(i)} y={rowY("rem") - 2} width={x(1)} height={4} fill={TONE} />
          ) : null)}
        </svg>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
        {ORDER.map((s) => <span key={s}>{LABEL[s]} {mins(s)} min</span>)}
      </div>
      <p className="text-[10px] text-muted-foreground">
        REM is drawn solid and sits above deep sleep · efficiency {Math.round((asleep / total) * 100)}% of {Math.round(total)} minutes in bed
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- visual field */
/**
 * A perimetry plot: sensitivity at each tested point, with the BLIND SPOT
 * where it belongs — about 15° temporal, which is normal and must not read
 * as a defect.
 */
export function VisualField({
  points, eye = "right", size = 280, label,
}: {
  /** degrees from fixation, dB sensitivity */ points: { x: number; y: number; db: number }[];
  eye?: "left" | "right"; size?: number; label?: string;
}) {
  if (!points.length) return null;
  const R = 30;
  const px = (d: number) => 50 + (d / R) * 42 * (eye === "left" ? -1 : 1);
  const py = (d: number) => 50 - (d / R) * 42;
  const low = points.filter((p) => p.db < 15).length;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${low} points below 15 dB`}>
        {[10, 20, 30].map((d) => (
          <circle key={d} cx={50} cy={50} r={(d / R) * 42} fill="none" stroke={TONE} strokeWidth={0.3} strokeOpacity={0.3} strokeDasharray="1.5 1.5" />
        ))}
        <line x1={50} y1={6} x2={50} y2={94} stroke={TONE} strokeWidth={0.3} strokeOpacity={0.3} />
        <line x1={6} y1={50} x2={94} y2={50} stroke={TONE} strokeWidth={0.3} strokeOpacity={0.3} />
        {points.map((p, i) => {
          // Darker is a WORSE result, matching the printed greyscale plot.
          const k = Math.max(0, Math.min(1, 1 - p.db / 34));
          return (
            <g key={i}>
              <rect x={px(p.x) - 3.2} y={py(p.y) - 3.2} width={6.4} height={6.4} rx={0.6}
                fill={TONE} fillOpacity={k * 0.95} />
              <text x={px(p.x)} y={py(p.y) + 1.6} fontSize={3.2} textAnchor="middle"
                fill={inkOn(Math.round(k * 92))}>{p.db}</text>
            </g>
          );
        })}
        <circle cx={50} cy={50} r={1.4} fill={TONE} />
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {eye === "right" ? "Right" : "Left"} eye, {R}° field, darker is worse · the dark patch at 15° temporal is the blind spot and is normal ·
        {low} points below 15 dB
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- body map */
/** Pain or symptom sites on a figure, with intensity as the fill. */
export function BodyMap({
  marks, size = 200, label,
}: {
  marks: { region: string; x: number; y: number; intensity: number }[]; size?: number; label?: string;
}) {
  if (!marks.length) return null;
  const worst = marks.reduce((a, b) => (b.intensity > a.intensity ? b : a));

  return (
    <div className="w-full">
      <svg viewBox="0 0 60 120" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `worst at ${worst.region}`}>
        <g fill="none" stroke={TONE} strokeWidth={1} strokeLinejoin="round">
          <circle cx={30} cy={11} r={7} />
          <path d="M23 20 L37 20 L41 26 L41 52 L37 52 L37 76 L34 108 L27 108 L24 76 L20 52 L16 52 L16 26 Z" />
          <path d="M41 28 L48 34 L48 58 L44 58 L44 36" />
          <path d="M16 28 L9 34 L9 58 L13 58 L13 36" />
          <path d="M27 108 L27 116 M34 108 L34 116" />
        </g>
        {marks.map((m) => (
          <circle key={m.region} cx={m.x} cy={m.y} r={3 + m.intensity * 2.4}
            fill={TONE} fillOpacity={0.2 + m.intensity * 0.7}>
            <title>{m.region}: {Math.round(m.intensity * 10)}/10</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 space-y-0.5">
        {[...marks].sort((a, b) => b.intensity - a.intensity).map((m) => (
          <p key={m.region} className="text-[10px] text-muted-foreground">
            {m.region} · {Math.round(m.intensity * 10)}/10
          </p>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ spirometry loop */
/**
 * The flow-volume loop.
 *
 * The SHAPE is the diagnosis — a scooped expiratory limb is obstruction, a
 * narrow tall loop is restriction — so the predicted loop is drawn behind the
 * measured one and the ratio is computed, not asserted.
 */
export function SpirometryLoop({
  measured, predicted, fev1, fvc, height = 250, label,
}: {
  /** volume in L, flow in L/s; positive flow is expiratory */
  measured: { volume: number; flow: number }[];
  predicted?: { volume: number; flow: number }[];
  fev1: number; fvc: number; height?: number; label?: string;
}) {
  if (measured.length < 3) return null;
  const all = [...measured, ...(predicted ?? [])];
  const vHi = Math.max(...all.map((p) => p.volume)) * 1.05;
  const fHi = Math.max(...all.map((p) => p.flow)) * 1.1;
  const fLo = Math.min(...all.map((p) => p.flow)) * 1.1;
  const x = (v: number) => (v / vHi) * 100;
  const y = (f: number) => 100 - ((f - fLo) / (fHi - fLo)) * 100;
  const pts = (a: { volume: number; flow: number }[]) => a.map((p) => `${x(p.volume)},${y(p.flow)}`).join(" ");
  const ratio = fvc > 0 ? fev1 / fvc : 0;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `FEV1/FVC ${(ratio * 100).toFixed(0)}%`}>
        <line x1={0} y1={y(0)} x2={100} y2={y(0)} stroke={TONE} strokeWidth={1} strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />
        {predicted ? (
          <polygon points={pts(predicted)} fill="none" stroke={TONE} strokeWidth={1.2}
            strokeDasharray="4 3" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
        ) : null}
        <polygon points={pts(measured)} fill={TONE} fillOpacity={0.1} stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>0 L</span><span>volume →</span><span>{vHi.toFixed(1)} L</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Above the line is expiratory · dashed is predicted ·
        FEV₁ {fev1.toFixed(2)} / FVC {fvc.toFixed(2)} = {(ratio * 100).toFixed(0)}%
        {ratio < 0.7 ? " — below 0.70, an obstructive pattern" : " — at or above 0.70"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------ medication schedule */
/** What is taken when, across a day, with interactions flagged on the row. */
export function MedicationSchedule({
  drugs, label,
}: {
  drugs: { name: string; dose: string; hours: number[]; withFood?: boolean; note?: string }[];
  label?: string;
}) {
  if (!drugs.length) return null;
  const doses = drugs.reduce((s, d) => s + d.hours.length, 0);

  return (
    <div className="w-full">
      <div className="mb-1 flex text-[9px] text-muted-foreground" style={{ paddingLeft: "38%" }}>
        {[0, 6, 12, 18].map((h) => <span key={h} className="flex-1">{String(h).padStart(2, "0")}:00</span>)}
      </div>
      <div className="space-y-1">
        {drugs.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <div className="w-[38%] shrink-0">
              <div className="truncate text-[10px] font-medium">{d.name}</div>
              <div className="truncate text-[9px] text-muted-foreground">
                {d.dose}{d.withFood ? " · with food" : ""}{d.note ? ` · ${d.note}` : ""}
              </div>
            </div>
            <div className="relative h-5 flex-1 rounded-[2px]" style={{ background: "var(--muted)" }}>
              {[6, 12, 18].map((h) => (
                <span key={h} className="absolute top-0 bottom-0 w-px" style={{ left: `${(h / 24) * 100}%`, background: "var(--border)" }} />
              ))}
              {d.hours.map((h) => (
                <span key={h} className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ left: `${(h / 24) * 100}%`, background: TONE }} title={`${String(h).padStart(2, "0")}:00`} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        {doses} doses a day across {drugs.length} medicines · a filled dot is one dose
      </p>
    </div>
  );
}

/* ----------------------------------------------------------- vaccine coverage */
/**
 * Coverage by cohort against the herd-immunity threshold.
 *
 * The threshold comes from R₀ (1 − 1/R₀) and is CALCULATED, because a line
 * drawn at a round number is the commonest way this chart misleads.
 */
export function VaccineCoverage({
  cohorts, r0, height = 220, label,
}: {
  cohorts: { label: string; covered: number }[]; r0: number; height?: number; label?: string;
}) {
  if (!cohorts.length || r0 <= 1) return null;
  const threshold = 1 - 1 / r0;
  const below = cohorts.filter((c) => c.covered < threshold);

  return (
    <div className="w-full">
      <div className="relative flex items-end gap-1.5" style={{ height }}>
        {cohorts.map((c) => {
          const short = c.covered < threshold;
          return (
            <div key={c.label} className="relative h-full flex-1" title={`${c.label} · ${Math.round(c.covered * 100)}%`}>
              <div className="absolute bottom-0 w-full" style={{
                height: `${c.covered * 100}%`,
                background: short ? "var(--background)" : TONE,
                border: short ? `2px solid ${TONE}` : undefined,
              }} />
            </div>
          );
        })}
        <div className="pointer-events-none absolute right-0 left-0 border-t-2 border-dashed border-foreground" style={{ bottom: `${threshold * 100}%` }}>
          <span className="absolute -top-4 right-0 text-[10px] font-medium">{Math.round(threshold * 100)}%</span>
        </div>
      </div>
      <div className="mt-1 flex gap-1.5">
        {cohorts.map((c) => <span key={c.label} className="flex-1 text-center text-[9px] text-muted-foreground">{c.label}</span>)}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        Threshold is 1 − 1/R₀ with R₀ {r0} — {Math.round(threshold * 100)}%, not a round number ·
        {below.length ? ` ${below.map((c) => c.label).join(", ")} below it (outlined)` : " every cohort above it"}
      </p>
    </div>
  );
}
