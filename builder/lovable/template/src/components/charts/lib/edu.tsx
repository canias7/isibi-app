/** Teaching: marks, mastery, attendance and what a question actually measured. */

const TONE = "var(--foreground)";

/* ----------------------------------------------------------------- gradebook */
/**
 * Marks by student and assessment.
 *
 * Rows and columns are BOTH given a mean, because a low cell is a student
 * problem or an assessment problem and the grid alone cannot say which.
 */
export function GradebookHeat({
  students, assessments, /** marks[student][assessment], null = not sat */ marks, label,
}: {
  students: string[]; assessments: string[]; marks: (number | null)[][]; label?: string;
}) {
  if (!students.length || !assessments.length) return null;
  const mean = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const rowMean = marks.map(mean);
  const colMean = assessments.map((_, c) => mean(marks.map((r) => r[c])));
  // Annotated: with a `number | null` element type the accumulator unifies to
  // `number | null` and cannot index back into the array.
  const hardest = colMean.reduce<number>((best, m, i) => (m != null && (colMean[best] == null || m < colMean[best]!) ? i : best), 0);
  const missing = marks.flat().filter((m) => m == null).length;

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `auto repeat(${assessments.length}, minmax(30px, 1fr)) auto` }}>
        <span />
        {assessments.map((a) => (
          <span key={a} className="pb-1 text-center text-[9px] whitespace-nowrap text-muted-foreground"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: 52 }}>{a}</span>
        ))}
        <span className="pb-1 pl-1.5 text-[9px] text-muted-foreground">mean</span>
        {students.map((s, si) => (
          <div key={s} className="contents">
            <span className="self-center pr-1.5 text-[10px] whitespace-nowrap">{s}</span>
            {assessments.map((a, ai) => {
              const m = marks[si]?.[ai];
              return (
                <span key={a} className="flex aspect-square items-center justify-center text-[9px]"
                  style={{
                    background: m == null ? "var(--background)" : `color-mix(in oklch, ${TONE} ${Math.round(m * 92)}%, transparent)`,
                    color: m != null && m > 0.55 ? "var(--background)" : "var(--foreground)",
                    outline: m == null ? `1px dashed ${TONE}` : undefined, outlineOffset: -1,
                  }} title={`${s} · ${a}`}>
                  {m == null ? "" : Math.round(m * 100)}
                </span>
              );
            })}
            <span className="self-center pl-1.5 text-[10px] font-semibold tabular-nums">
              {rowMean[si] == null ? "—" : Math.round(rowMean[si]! * 100)}
            </span>
          </div>
        ))}
        <span className="pt-1 pr-1.5 text-right text-[9px] text-muted-foreground">mean</span>
        {colMean.map((m, i) => (
          <span key={i} className="pt-1 text-center text-[10px] font-semibold tabular-nums">
            {m == null ? "—" : Math.round(m * 100)}
          </span>
        ))}
        <span />
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Means on both edges · "{assessments[hardest]}" is the hardest at {Math.round((colMean[hardest] ?? 0) * 100)}%,
        which is an assessment finding, not a student one · {missing} not sat (dashed)
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ mastery grid */
/** Which objectives each learner has met, with the class gap identified. */
export function MasteryGrid({
  learners, objectives, /** levels[learner][objective] 0-3 */ levels, label,
}: {
  learners: string[]; objectives: string[]; levels: number[][]; label?: string;
}) {
  if (!learners.length || !objectives.length) return null;
  const GLYPH = ["·", "○", "◐", "●"];
  const NAME = ["not started", "emerging", "developing", "secure"];
  const perObj = objectives.map((_, o) => levels.reduce((s, r) => s + (r[o] >= 3 ? 1 : 0), 0));
  const weakest = perObj.indexOf(Math.min(...perObj));

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `auto repeat(${objectives.length}, minmax(28px, 1fr))` }}>
        <span />
        {objectives.map((o, i) => (
          <span key={o} className="pb-1 text-center text-[9px] text-muted-foreground" title={o}>{i + 1}</span>
        ))}
        {learners.map((l, li) => (
          <div key={l} className="contents">
            <span className="self-center pr-1.5 text-[10px] whitespace-nowrap">{l}</span>
            {objectives.map((o, oi) => {
              const v = levels[li]?.[oi] ?? 0;
              return (
                <span key={o} className="flex aspect-square items-center justify-center text-[13px]"
                  style={{ background: "var(--muted)", color: TONE, opacity: 0.35 + v * 0.22 }}
                  title={`${l} · ${o}: ${NAME[v]}`}>{GLYPH[v]}</span>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
        {GLYPH.map((g, i) => <span key={g}>{g} {NAME[i]}</span>)}
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Objective {weakest + 1} — {objectives[weakest]} — is secure for only {perObj[weakest]} of {learners.length}, so it is
        a whole-class reteach rather than intervention
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- attendance strip */
/**
 * Attendance day by day per learner.
 *
 * PERSISTENT absence is what matters and it is not the same as the rate: a
 * learner at 90% who misses every Friday is a different problem from one who
 * had two weeks of flu, so the longest run is computed too.
 */
export function AttendanceStrip({
  learners, days, label,
}: {
  learners: { name: string; marks: ("present" | "late" | "absent" | "authorised")[] }[];
  days: string[]; label?: string;
}) {
  if (!learners.length) return null;
  const style = (m: string) =>
    m === "present" ? { background: TONE }
      : m === "late" ? { background: TONE, opacity: 0.45 }
        : m === "authorised" ? { background: "var(--muted)" }
          : { background: "var(--background)", boxShadow: `inset 0 0 0 1.2px ${TONE}` };
  const rows = learners.map((l) => {
    const present = l.marks.filter((m) => m === "present" || m === "late").length;
    let run = 0, longest = 0;
    l.marks.forEach((m) => { if (m === "absent") { run++; longest = Math.max(longest, run); } else run = 0; });
    return { ...l, rate: present / l.marks.length, longest };
  }).sort((a, b) => a.rate - b.rate);
  const persistent = rows.filter((r) => r.rate < 0.9);

  return (
    <div className="w-full">
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-2">
            <span className="w-[26%] shrink-0 truncate text-[10px]">{r.name}</span>
            <div className="flex flex-1 gap-[1px]">
              {r.marks.map((m, i) => (
                <span key={i} className="h-3.5 flex-1 rounded-[1px]" style={style(m)} title={`${days[i] ?? i + 1}: ${m}`} />
              ))}
            </div>
            <span className="w-20 shrink-0 text-right text-[9px] tabular-nums text-muted-foreground">
              {Math.round(r.rate * 100)}% · run {r.longest}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[1px]" style={{ background: TONE }} />present</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[1px]" style={{ background: TONE, opacity: 0.45 }} />late</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[1px]" style={{ background: "var(--muted)" }} />authorised</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[1px]" style={{ boxShadow: `inset 0 0 0 1.2px ${TONE}` }} />absent</span>
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        {persistent.length} below 90% · the longest unbroken run matters as much as the rate — one long absence and
        many scattered ones need different responses
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- question analysis */
/**
 * Facility against discrimination for each question.
 *
 * A question everybody gets right measures nothing, and one the STRONGEST
 * candidates get wrong is broken — both fall out of plotting the two together,
 * and neither shows in a mark distribution.
 */
export function QuestionAnalysis({
  questions, height = 250, label,
}: {
  /** facility = proportion correct; discrimination = top group minus bottom group */
  questions: { id: string; facility: number; discrimination: number }[]; height?: number; label?: string;
}) {
  if (!questions.length) return null;
  const x = (v: number) => v * 100;
  const y = (v: number) => 50 - v * 45;
  const broken = questions.filter((q) => q.discrimination < 0);
  const trivial = questions.filter((q) => q.facility > 0.95 || q.facility < 0.05);

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">
          <rect x={0} y={y(0)} width={100} height={100 - y(0)} fill={TONE} fillOpacity={0.08} />
          <line x1={0} y1={y(0)} x2={100} y2={y(0)} stroke={TONE} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={y(0.2)} x2={100} y2={y(0.2)} stroke={TONE} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.45} vectorEffect="non-scaling-stroke" />
          {[0.25, 0.5, 0.75].map((v) => (
            <line key={v} x1={x(v)} y1={0} x2={x(v)} y2={100} stroke={TONE} strokeWidth={1} strokeOpacity={0.12} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {questions.map((q) => (
          <span key={q.id} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${x(q.facility)}%`, top: `${y(q.discrimination)}%`, width: 9, height: 9,
              background: q.discrimination < 0 ? "var(--background)" : TONE,
              border: q.discrimination < 0 ? `2px solid ${TONE}` : undefined,
            }} title={`${q.id}: ${Math.round(q.facility * 100)}% correct, D ${q.discrimination.toFixed(2)}`} />
        ))}
        {questions.map((q) => (
          <span key={`l${q.id}`} className="absolute text-[9px] text-muted-foreground"
            style={{ left: `${Math.min(92, x(q.facility) + 2.5)}%`, top: `${y(q.discrimination)}%`, transform: "translateY(-140%)" }}>{q.id}</span>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>nobody correct</span><span>facility →</span><span>everybody correct</span>
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Below the solid line the stronger candidates did WORSE — {broken.length ? `${broken.map((q) => q.id).join(", ")} ${broken.length === 1 ? "is" : "are"} broken` : "no question is inverted"} ·
        {trivial.length ? ` ${trivial.map((q) => q.id).join(", ")} discriminate nothing at that facility` : " every question separates candidates"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ cohort progression */
/** How a cohort moves between bands year on year, as flows. */
export function CohortProgression({
  bands, years, /** counts[year][band] */ counts, height = 250, label,
}: {
  bands: string[]; years: (string | number)[]; counts: number[][]; height?: number; label?: string;
}) {
  if (!counts.length) return null;
  const totals = counts.map((r) => r.reduce((a, b) => a + b, 0));
  const topShare = counts.map((r, i) => (r[bands.length - 1] ?? 0) / (totals[i] || 1));
  const gain = topShare[topShare.length - 1] - topShare[0];

  return (
    <div className="w-full">
      <div className="flex items-stretch gap-1" style={{ height }}>
        {counts.map((row, yi) => (
          <div key={String(years[yi])} className="flex flex-1 flex-col">
            {[...row].reverse().map((v, ri) => {
              const bi = bands.length - 1 - ri;
              return (
                <div key={bi} className="flex items-center justify-center overflow-hidden text-[9px]"
                  style={{
                    height: `${(v / (totals[yi] || 1)) * 100}%`,
                    background: `color-mix(in oklch, ${TONE} ${Math.round(12 + (bi / Math.max(1, bands.length - 1)) * 80)}%, transparent)`,
                    color: bi / Math.max(1, bands.length - 1) > 0.55 ? "var(--background)" : "var(--foreground)",
                    borderTop: "1px solid var(--background)",
                  }} title={`${years[yi]} · ${bands[bi]}: ${v}`}>
                  {v / (totals[yi] || 1) > 0.08 ? Math.round((v / (totals[yi] || 1)) * 100) + "%" : ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {years.map((y) => <span key={String(y)} className="flex-1 text-center text-[9px] text-muted-foreground">{y}</span>)}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
        {bands.map((b, i) => (
          <span key={b} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: `color-mix(in oklch, ${TONE} ${Math.round(12 + (i / Math.max(1, bands.length - 1)) * 80)}%, transparent)` }} />{b}
          </span>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Highest band {gain >= 0 ? "up" : "down"} {Math.abs(Math.round(gain * 100))} points over the period,
        from {Math.round(topShare[0] * 100)}% to {Math.round(topShare[topShare.length - 1] * 100)}%
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- reading ladder */
/** Texts placed on a difficulty scale against a reader's current level. */
export function ReadingLadder({
  texts, readerLevel, label,
}: {
  texts: { title: string; level: number }[]; readerLevel: number; label?: string;
}) {
  if (!texts.length) return null;
  const sorted = [...texts].sort((a, b) => a.level - b.level);
  const lo = Math.min(...sorted.map((t) => t.level), readerLevel) - 0.4;
  const hi = Math.max(...sorted.map((t) => t.level), readerLevel) + 0.4;
  const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;
  // The instructional band: a little above the reader, where they learn rather
  // than either coast or stall.
  const band = { from: readerLevel, to: readerLevel + 0.6 };
  const inBand = sorted.filter((t) => t.level >= band.from && t.level <= band.to);

  return (
    <div className="w-full">
      <div className="relative mb-2 h-5 rounded-[3px]" style={{ background: "var(--muted)" }}>
        <div className="absolute top-0 bottom-0 rounded-[3px]"
          style={{ left: `${pos(band.from)}%`, width: `${pos(band.to) - pos(band.from)}%`, background: TONE, opacity: 0.22 }} />
        <div className="absolute top-[-3px] bottom-[-3px] w-0.5" style={{ left: `${pos(readerLevel)}%`, background: TONE }} />
      </div>
      <div className="space-y-1">
        {sorted.map((t) => {
          const rel = t.level < band.from ? "easy" : t.level <= band.to ? "just right" : "too hard alone";
          return (
            <div key={t.title} className="flex items-center gap-2">
              <span className="w-[44%] shrink-0 truncate text-[10px]">{t.title}</span>
              <div className="relative h-2.5 flex-1 rounded-[2px]" style={{ background: "var(--muted)" }}>
                <span className="absolute top-[-2px] bottom-[-2px] w-1 rounded-[1px]"
                  style={{ left: `${pos(t.level)}%`, background: TONE, opacity: rel === "just right" ? 1 : 0.4 }} />
              </div>
              <span className="w-24 shrink-0 text-right text-[9px] text-muted-foreground">{t.level.toFixed(1)} · {rel}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Reader at {readerLevel.toFixed(1)} · the shaded band is where they learn rather than coast or stall ·
        {inBand.length} of {texts.length} sit in it
      </p>
    </div>
  );
}
