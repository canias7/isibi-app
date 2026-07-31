/** Ownership, debt and the ladders people are taxed and rated on. */

const TONE = "var(--foreground)";
const money = (n: number, cur = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
/**
 * Whole pounds are right for a total and wrong for a unit price: rounding
 * $2.40 a share to "$2" made the same sentence say $2 × 10M = $24M.
 */
const unitMoney = (n: number, cur = "USD") =>
  new Intl.NumberFormat(undefined, {
    style: "currency", currency: cur,
    minimumFractionDigits: 2, maximumFractionDigits: Number.isInteger(n * 100) ? 2 : 4,
  }).format(n);

/* ------------------------------------------------------------------ cap table */
/**
 * Who owns what, as shares AND as a percentage computed from them.
 *
 * The percentage is derived, never a second prop — a cap table whose stated
 * percentages do not sum to 100, or do not match its own share counts, is
 * the single most common spreadsheet error in this document.
 */
export function CapTable({
  holders, currency = "USD", pricePerShare, label,
}: {
  holders: { name: string; shares: number; kind?: string }[];
  currency?: string; pricePerShare?: number; label?: string;
}) {
  if (!holders.length) return null;
  const total = holders.reduce((s, h) => s + h.shares, 0);
  const sorted = [...holders].sort((a, b) => b.shares - a.shares);

  return (
    <div className="w-full">
      <div className="flex h-6 overflow-hidden rounded-[3px]">
        {sorted.map((h, i) => (
          <span key={h.name} title={`${h.name} · ${((h.shares / total) * 100).toFixed(1)}%`}
            style={{
              width: `${(h.shares / total) * 100}%`,
              background: TONE,
              opacity: 1 - (i / Math.max(1, sorted.length)) * 0.72,
              borderRight: "1px solid var(--background)",
            }} />
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {sorted.map((h, i) => (
          <div key={h.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: TONE, opacity: 1 - (i / Math.max(1, sorted.length)) * 0.72 }} />
            <span className="flex-1 truncate text-[11px]">{h.name}{h.kind ? <span className="text-muted-foreground"> · {h.kind}</span> : null}</span>
            <span className="text-[10px] tabular-nums text-muted-foreground">{h.shares.toLocaleString()}</span>
            <span className="w-11 text-right text-[11px] font-semibold tabular-nums">{((h.shares / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        {total.toLocaleString()} shares{pricePerShare ? ` · ${money(total * pricePerShare, currency)} at ${unitMoney(pricePerShare, currency)} a share` : ""} ·
        percentages are computed from the share counts
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ vesting schedule */
/**
 * A grant vesting over time, with the CLIFF drawn as the step it is.
 *
 * Nothing vests until the cliff and then a whole chunk does at once — drawn
 * as a straight line from zero, which is how most of these are illustrated,
 * it tells the holder something untrue about what they own next month.
 */
export function VestingSchedule({
  total, months, cliffMonths, elapsedMonths, height = 220, label,
}: {
  total: number; months: number; cliffMonths: number; elapsedMonths?: number;
  height?: number; label?: string;
}) {
  if (months <= 0) return null;
  // Floored: a grant vests in whole shares, and "15,833.333 vested" is not a
  // thing anybody owns.
  const vestedAt = (m: number) => (m < cliffMonths ? 0 : Math.min(total, Math.floor((total * Math.floor(m)) / months)));
  const pts: { m: number; v: number }[] = [];
  for (let m = 0; m <= months; m++) pts.push({ m, v: vestedAt(m) });
  const x = (m: number) => (m / months) * 100;
  const y = (v: number) => 100 - (v / total) * 100;
  const now = elapsedMonths ?? 0;
  const vestedNow = vestedAt(now);

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `${vestedNow.toLocaleString()} of ${total.toLocaleString()} vested`}>
        <polygon points={`0,100 ${pts.map((p) => `${x(p.m)},${y(p.v)}`).join(" ")} 100,100`} fill={TONE} fillOpacity={0.14} />
        <polyline points={pts.map((p) => `${x(p.m)},${y(p.v)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <line x1={x(cliffMonths)} y1={0} x2={x(cliffMonths)} y2={100}
          stroke={TONE} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.55} vectorEffect="non-scaling-stroke" />
        {elapsedMonths != null ? (
          <line x1={x(now)} y1={0} x2={x(now)} y2={100} stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        ) : null}
      </svg>
      <div className="relative mt-1 h-3.5">
        <span className="absolute -translate-x-1/2 text-[10px] text-muted-foreground" style={{ left: `${x(cliffMonths)}%` }}>cliff</span>
        {elapsedMonths != null ? (
          <span className="absolute -translate-x-1/2 text-[10px] font-medium" style={{ left: `${x(now)}%` }}>now</span>
        ) : null}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Nothing until month {cliffMonths}, then {((cliffMonths / months) * 100).toFixed(0)}% at once ·
        {elapsedMonths != null ? ` ${vestedNow.toLocaleString()} of ${total.toLocaleString()} vested` : ` ${total.toLocaleString()} over ${months} months`}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- amortisation */
/**
 * A loan split into interest and principal, month by month.
 *
 * The whole reason to draw this: early payments are almost all interest, and
 * the crossover month — computed here — is the fact borrowers are surprised by.
 */
export function Amortisation({
  principal, annualRate, years, currency = "USD", height = 230, label,
}: {
  principal: number; annualRate: number; years: number; currency?: string; height?: number; label?: string;
}) {
  const n = Math.round(years * 12);
  if (n <= 0 || principal <= 0) return null;
  const r = annualRate / 12;
  const pay = r > 0 ? (principal * r) / (1 - Math.pow(1 + r, -n)) : principal / n;
  let bal = principal;
  const rows = Array.from({ length: n }, () => {
    const interest = bal * r;
    const capital = pay - interest;
    bal = Math.max(0, bal - capital);
    return { interest, capital };
  });
  const cross = rows.findIndex((m) => m.capital > m.interest);
  const totalInterest = rows.reduce((s, m) => s + m.interest, 0);

  return (
    <div className="w-full">
      <div className="relative flex items-end" style={{ height }}>
        {rows.map((m, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end" title={`month ${i + 1}`}>
            <span style={{ height: `${(m.interest / pay) * 100}%`, background: TONE,
              backgroundImage: `repeating-linear-gradient(45deg, transparent 0 2px, var(--background) 2px 3px)` }} />
            <span style={{ height: `${(m.capital / pay) * 100}%`, background: TONE }} />
          </div>
        ))}
        {cross >= 0 ? (
          <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-foreground" style={{ left: `${(cross / n) * 100}%` }} />
        ) : null}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>month 1</span><span>month {n}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5" style={{ background: TONE }} />principal</span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5" style={{ background: TONE, backgroundImage: "repeating-linear-gradient(45deg, transparent 0 2px, var(--background) 2px 3px)" }} />interest
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        {money(pay, currency)} a month · {cross >= 0 ? `principal only overtakes interest at month ${cross + 1}` : "interest exceeds principal throughout"} ·
        {money(totalInterest, currency)} interest over the term
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- tax ladder */
/**
 * Marginal bands, and the EFFECTIVE rate that comes out of them.
 *
 * The gap between the two is the misconception this chart exists to close:
 * being "in the 40% band" does not mean paying 40% of everything.
 */
export function TaxLadder({
  bands, income, currency = "USD", height = 220, label,
}: {
  /** ascending, `upTo` null for the top band */ bands: { upTo: number | null; rate: number }[];
  income: number; currency?: string; height?: number; label?: string;
}) {
  if (!bands.length) return null;
  const top = bands[bands.length - 1].upTo ?? Math.max(income * 1.2, (bands[bands.length - 2]?.upTo ?? income) * 1.4);
  let prev = 0, tax = 0;
  const segs = bands.map((b) => {
    const ceiling = b.upTo ?? top;
    const inBand = Math.max(0, Math.min(income, ceiling) - prev);
    const owed = inBand * b.rate;
    tax += owed;
    const seg = { from: prev, to: ceiling, rate: b.rate, inBand, owed };
    prev = ceiling;
    return seg;
  });
  const effective = income > 0 ? tax / income : 0;
  const marginal = segs.find((s) => income > s.from && income <= s.to)?.rate ?? bands[bands.length - 1].rate;

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        {segs.map((s, i) => {
          // Mixed into the background rather than set with `opacity`: opacity on
          // the band creates a group, so the "darker" filled overlay inside it
          // multiplies down and comes out LIGHTER than the band it sits on.
          const band = Math.round((0.08 + s.rate * 0.55) * 100);
          const filled = Math.min(96, band + 34);
          return (
            <div key={i} className="absolute right-0 left-0" style={{
              bottom: `${(s.from / top) * 100}%`, height: `${((s.to - s.from) / top) * 100}%`,
              background: `color-mix(in oklch, ${TONE} ${band}%, transparent)`,
              borderTop: "1px solid var(--background)",
            }}>
              {s.inBand > 0 ? (
                <div className="absolute bottom-0 left-0 h-full"
                  style={{ width: "38%", background: `color-mix(in oklch, ${TONE} ${filled}%, transparent)` }} />
              ) : null}
              <span className="absolute top-0.5 left-1 text-[9px] font-medium"
                style={{ color: filled > 55 && s.inBand > 0 ? "var(--background)" : "var(--foreground)" }}>
                {Math.round(s.rate * 100)}%
              </span>
            </div>
          );
        })}
        <div className="absolute right-0 left-0 border-t-2 border-foreground" style={{ bottom: `${(income / top) * 100}%` }}>
          <span className="absolute -top-4 right-0 text-[10px] font-medium">{money(income, currency)}</span>
        </div>
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Marginal {Math.round(marginal * 100)}% · effective {(effective * 100).toFixed(1)}% · {money(tax, currency)} on {money(income, currency)}
      </p>
      <p className="text-[10px] text-muted-foreground">The darker left band is the part of each band actually filled</p>
    </div>
  );
}

/* ------------------------------------------------------- dilution waterfall */
/**
 * A founder's stake across funding rounds — percentage falling, value rising.
 *
 * Both are drawn, because either alone tells half the story: a founder whose
 * share halved while the company went up tenfold is better off, and a chart
 * of percentage only says the opposite.
 */
export function DilutionWaterfall({
  rounds, currency = "USD", height = 220, label,
}: {
  rounds: { name: string; ownership: number; valuation: number }[];
  currency?: string; height?: number; label?: string;
}) {
  if (!rounds.length) return null;
  const maxVal = Math.max(...rounds.map((r) => r.valuation));
  const first = rounds[0], last = rounds[rounds.length - 1];
  const worth = (r: { ownership: number; valuation: number }) => r.ownership * r.valuation;

  return (
    <div className="w-full">
      <div className="relative flex items-end gap-2" style={{ height }}>
        {rounds.map((r, i) => (
          <div key={r.name} className="relative flex-1" style={{ height: "100%" }}>
            <div className="absolute bottom-0 w-full" style={{ height: `${(r.valuation / maxVal) * 100}%`, background: TONE, opacity: 0.14 }} />
            <div className="absolute bottom-0 w-full" style={{ height: `${(worth(r) / maxVal) * 100}%`, background: TONE }}
              title={`${r.name} · ${money(worth(r), currency)}`} />
            <span className="absolute right-0 left-0 text-center text-[10px] font-semibold tabular-nums"
              style={{ bottom: `calc(${(worth(r) / maxVal) * 100}% + 2px)` }}>
              {(r.ownership * 100).toFixed(1)}%
            </span>
            {i > 0 ? (
              <div className="absolute left-0 h-px w-full" style={{ bottom: `${(worth(rounds[i - 1]) / maxVal) * 100}%`, background: TONE, opacity: 0.3 }} />
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        {rounds.map((r) => <span key={r.name} className="flex-1 text-center text-[9px] text-muted-foreground">{r.name}</span>)}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        Solid is the stake's value, pale is the whole company ·
        {(first.ownership * 100).toFixed(0)}% → {(last.ownership * 100).toFixed(0)}% while it is worth
        {" "}{money(worth(first), currency)} → {money(worth(last), currency)}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- energy label */
/**
 * The A–G ladder, as used for appliances and buildings. Each rung is a
 * different LENGTH as well as a different shade, so the ranking survives
 * greyscale and a photocopier.
 */
export function EnergyLabel({
  grade, value, unit, scale = ["A", "B", "C", "D", "E", "F", "G"], size = 300, label,
}: {
  grade: string; value?: number; unit?: string; scale?: string[]; size?: number; label?: string;
}) {
  const idx = scale.indexOf(grade);
  return (
    <div className="w-full" style={{ maxWidth: size }} role="img" aria-label={label ?? `rated ${grade} of ${scale.join("–")}`}>
      <div className="space-y-1">
        {scale.map((g, i) => {
          const on = i === idx;
          return (
            <div key={g} className="flex items-center gap-2">
              <div className="relative flex h-6 items-center"
                style={{ width: `${38 + (i / Math.max(1, scale.length - 1)) * 58}%` }}>
                <div className="h-full w-full rounded-l-[2px]"
                  style={{
                    background: TONE,
                    opacity: 0.16 + (1 - i / Math.max(1, scale.length - 1)) * 0.72,
                    clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)",
                  }} />
                <span className="absolute left-2 text-[12px] font-bold"
                  style={{ color: i < scale.length / 2 ? "var(--background)" : "var(--foreground)" }}>{g}</span>
              </div>
              {on ? (
                <span className="rounded-[3px] px-1.5 py-0.5 text-[11px] font-semibold"
                  style={{ background: TONE, color: "var(--background)" }}>
                  {grade}{value != null ? ` · ${value}${unit ? ` ${unit}` : ""}` : ""}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        Each rung is longer as well as paler, so the order survives in greyscale
      </p>
    </div>
  );
}
