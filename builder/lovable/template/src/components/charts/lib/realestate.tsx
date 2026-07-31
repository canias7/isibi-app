/** Property: comparables, absorption, leases and what the sun does to a plot. */

const TONE = "var(--foreground)";
const money = (n: number, cur = "GBP") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);

/* ----------------------------------------------------------- comparable grid */
/**
 * Comparable sales with their ADJUSTMENTS shown, and the adjusted value
 * computed — an appraisal that lists comparables without the adjustments is
 * showing its inputs and hiding its reasoning.
 */
export function ComparableGrid({
  subject, comparables, currency = "GBP", label,
}: {
  subject: { address: string; sqm: number; beds: number };
  comparables: { address: string; price: number; sqm: number; beds: number; monthsAgo: number }[];
  currency?: string; label?: string;
}) {
  if (!comparables.length) return null;
  // Adjust to the subject: size at the comparable's own rate, beds at a fixed
  // increment, time at a market drift. Each adjustment is shown, not netted.
  const DRIFT = 0.004, BED = 18000;
  const rows = comparables.map((c) => {
    const rate = c.price / c.sqm;
    const size = (subject.sqm - c.sqm) * rate;
    const beds = (subject.beds - c.beds) * BED;
    const time = c.price * DRIFT * c.monthsAgo;
    return { ...c, rate, size, beds, time, adjusted: c.price + size + beds + time };
  });
  const values = rows.map((r) => r.adjusted).sort((a, b) => a - b);
  const median = values[Math.floor(values.length / 2)];
  const spread = (values[values.length - 1] - values[0]) / median;

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-[10px] tabular-nums">
        <tbody>
          <tr className="text-muted-foreground">
            <td className="pb-1 text-left font-semibold">Comparable</td>
            <td className="pb-1 text-right font-semibold">Sold</td>
            <td className="pb-1 text-right">size</td>
            <td className="pb-1 text-right">beds</td>
            <td className="pb-1 text-right">time</td>
            <td className="pb-1 text-right font-semibold">Adjusted</td>
          </tr>
          {rows.map((r) => (
            <tr key={r.address}>
              <td className="truncate pr-2 text-left">{r.address}<span className="text-muted-foreground"> · {r.sqm} m² · {r.beds} bed</span></td>
              <td className="pr-2 text-right">{money(r.price, currency)}</td>
              {[r.size, r.beds, r.time].map((v, i) => (
                <td key={i} className="pr-2 text-right text-muted-foreground">
                  {v === 0 ? "—" : `${v > 0 ? "+" : "−"}${money(Math.abs(v), currency).replace(/^[^\d]*/, "")}`}
                </td>
              ))}
              <td className="text-right font-semibold">{money(r.adjusted, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Adjusted to {subject.address} at {subject.sqm} m², {subject.beds} bed · median {money(median, currency)},
        spread {Math.round(spread * 100)}% — a wide spread means the comparables are not comparable
      </p>
    </div>
  );
}

/* ---------------------------------------------------------- absorption rate */
/**
 * Units sold per month against what remains, with MONTHS OF SUPPLY computed —
 * the number that says whether it is a buyers' or a sellers' market, and the
 * one a raw sales count cannot give.
 */
export function AbsorptionRate({
  months, height = 240, label,
}: {
  months: { label: string; sold: number; listed: number }[]; height?: number; label?: string;
}) {
  if (!months.length) return null;
  const rows = months.map((m) => ({ ...m, supply: m.sold > 0 ? m.listed / m.sold : Infinity }));
  const max = Math.max(...rows.map((m) => m.listed));
  const recent = rows.slice(-3);
  const meanSupply = recent.reduce((s, r) => s + (Number.isFinite(r.supply) ? r.supply : 0), 0) / recent.length;
  const market = meanSupply < 4 ? "a sellers' market" : meanSupply > 7 ? "a buyers' market" : "balanced";

  return (
    <div className="w-full">
      <div className="flex items-end gap-1.5" style={{ height }}>
        {rows.map((m) => (
          <div key={m.label} className="relative h-full flex-1" title={`${m.label}: ${m.sold} of ${m.listed}`}>
            <div className="absolute bottom-0 w-full" style={{ height: `${(m.listed / max) * 100}%`, background: TONE, opacity: 0.22 }} />
            <div className="absolute bottom-0 w-full" style={{ height: `${(m.sold / max) * 100}%`, background: TONE }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {rows.map((m) => <span key={m.label} className="flex-1 text-center text-[9px] text-muted-foreground">{m.label}</span>)}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        Pale is stock on the market, solid is what sold · {meanSupply.toFixed(1)} months of supply on the last
        three months, which is {market}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ rent roll */
/** Every tenancy with its rent, term and what it contributes to the total. */
export function RentRoll({
  tenancies, currency = "GBP", label,
}: {
  tenancies: { tenant: string; sqm: number; annualRent: number; yearsLeft: number }[]; currency?: string; label?: string;
}) {
  if (!tenancies.length) return null;
  const total = tenancies.reduce((s, t) => s + t.annualRent, 0);
  const rows = [...tenancies].sort((a, b) => b.annualRent - a.annualRent);
  // Weighted average unexpired term — the single number an investor asks for.
  const wault = rows.reduce((s, t) => s + t.yearsLeft * t.annualRent, 0) / total;
  const top = rows[0];

  return (
    <div className="w-full">
      <div className="space-y-1">
        {rows.map((t) => (
          <div key={t.tenant} className="flex items-center gap-2">
            <span className="w-[30%] shrink-0 truncate text-[10px]">{t.tenant}</span>
            <div className="relative h-3.5 flex-1 rounded-[2px]" style={{ background: "var(--muted)" }}>
              <span className="absolute top-0 bottom-0 left-0 rounded-[2px]" style={{ width: `${(t.annualRent / top.annualRent) * 100}%`, background: TONE }} />
            </div>
            <span className="w-32 shrink-0 text-right text-[9px] tabular-nums text-muted-foreground">
              {money(t.annualRent, currency)} · {Math.round((t.annualRent / t.sqm))}/m² · {t.yearsLeft}y
            </span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        {money(total, currency)} a year across {tenancies.length} tenancies · WAULT {wault.toFixed(1)} years ·
        {top.tenant} alone is {Math.round((top.annualRent / total) * 100)}% of income, which is the concentration risk
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- lease expiry */
/**
 * When leases fall due, as a profile.
 *
 * A cliff — several big leases expiring in one year — is the risk, and it is
 * identified rather than left to be spotted.
 */
export function LeaseExpiry({
  leases, currency = "GBP", height = 230, label,
}: {
  leases: { tenant: string; expiryYear: number; annualRent: number }[]; currency?: string;
  height?: number; label?: string;
}) {
  if (!leases.length) return null;
  const total = leases.reduce((s, l) => s + l.annualRent, 0);
  const years = [...new Set(leases.map((l) => l.expiryYear))].sort((a, b) => a - b);
  const byYear = years.map((y) => {
    const mine = leases.filter((l) => l.expiryYear === y);
    return { year: y, rent: mine.reduce((s, l) => s + l.annualRent, 0), count: mine.length };
  });
  const max = Math.max(...byYear.map((b) => b.rent));
  const cliff = byYear.reduce((a, b) => (b.rent > a.rent ? b : a));

  return (
    <div className="w-full">
      <div className="relative flex items-end gap-1.5" style={{ height }}>
        {byYear.map((b) => {
          const big = b.rent / total > 0.25;
          return (
            <div key={b.year} className="flex-1" title={`${b.year}: ${b.count} leases`}
              style={{
                height: `${(b.rent / max) * 100}%`,
                background: big ? "var(--background)" : TONE,
                border: big ? `2px solid ${TONE}` : undefined,
              }} />
          );
        })}
      </div>
      <div className="mt-1 flex gap-1.5">
        {byYear.map((b) => <span key={b.year} className="flex-1 text-center text-[9px] text-muted-foreground">{b.year}</span>)}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        {money(total, currency)} of income · the biggest cliff is {cliff.year} with {cliff.count} lease
        {cliff.count === 1 ? "" : "s"} and {Math.round((cliff.rent / total) * 100)}% of income falling due at once
        (outlined bars are over a quarter)
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ floor plate */
/**
 * Usable against gross area per floor, with the EFFICIENCY computed.
 *
 * Rent is charged on gross and used on net, so the ratio is what a tenant is
 * actually buying — and it varies floor to floor around a core.
 */
export function FloorPlate({
  floors, label,
}: {
  floors: { name: string; grossSqm: number; coreSqm: number; circulationSqm: number }[]; label?: string;
}) {
  if (!floors.length) return null;
  const rows = floors.map((f) => {
    const net = f.grossSqm - f.coreSqm - f.circulationSqm;
    return { ...f, net, efficiency: net / f.grossSqm };
  });
  const max = Math.max(...rows.map((r) => r.grossSqm));
  const best = rows.reduce((a, b) => (b.efficiency > a.efficiency ? b : a));
  const worst = rows.reduce((a, b) => (b.efficiency < a.efficiency ? b : a));

  return (
    <div className="w-full space-y-1.5">
      {[...rows].reverse().map((f) => (
        <div key={f.name}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-medium">{f.name}</span>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {f.net} of {f.grossSqm} m² · {Math.round(f.efficiency * 100)}% efficient
            </span>
          </div>
          <div className="mt-0.5 flex h-4 overflow-hidden rounded-[2px]" style={{ width: `${(f.grossSqm / max) * 100}%` }}>
            <span style={{ width: `${(f.net / f.grossSqm) * 100}%`, background: TONE }} title="lettable" />
            <span style={{ width: `${(f.coreSqm / f.grossSqm) * 100}%`, background: TONE, opacity: 0.5 }} title="core" />
            <span style={{
              width: `${(f.circulationSqm / f.grossSqm) * 100}%`, background: TONE, opacity: 0.5,
              backgroundImage: "repeating-linear-gradient(45deg, transparent 0 2px, var(--background) 2px 3px)",
            }} title="circulation" />
          </div>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Solid lettable, mid core, hatched circulation · {best.name} is the most efficient at
        {" "}{Math.round(best.efficiency * 100)}%, {worst.name} the least at {Math.round(worst.efficiency * 100)}% —
        the tenant pays gross either way
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------- sun study */
/**
 * Hours of direct sun across a plot, by season.
 *
 * WINTER is the binding case — a garden that works in June and never sees the
 * sun in December is the complaint — so the worst season is called out.
 */
export function SunStudy({
  seasons, size = 320, label,
}: {
  /** grid[row][col] = hours of direct sun */ seasons: { name: string; grid: number[][] }[];
  size?: number; label?: string;
}) {
  if (!seasons.length) return null;
  const maxH = Math.max(...seasons.flatMap((s) => s.grid.flat()));
  const means = seasons.map((s) => {
    const f = s.grid.flat();
    return { name: s.name, mean: f.reduce((a, b) => a + b, 0) / f.length, shaded: f.filter((v) => v < 2).length / f.length };
  });
  const worst = means.reduce((a, b) => (b.mean < a.mean ? b : a));

  return (
    <div className="w-full" style={{ maxWidth: size }}>
      <div className="flex gap-2">
        {seasons.map((s) => {
          const rows = s.grid.length, cols = s.grid[0].length;
          return (
            <div key={s.name} className="flex-1">
              <div className="mb-0.5 text-center text-[9px] text-muted-foreground">{s.name}</div>
              <svg viewBox="0 0 100 100" width="100%">
                {s.grid.flatMap((row, r) => row.map((v, c) => (
                  <rect key={`${r}-${c}`} x={(c / cols) * 100} y={(r / rows) * 100}
                    width={100 / cols + 0.4} height={100 / rows + 0.4}
                    fill={TONE} fillOpacity={0.06 + (v / maxH) * 0.88} />
                )))}
              </svg>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 space-y-0.5">
        {means.map((m) => (
          <p key={m.name} className="text-[10px] text-muted-foreground">
            {m.name} · {m.mean.toFixed(1)} h mean · {Math.round(m.shaded * 100)}% of the plot under 2 h
          </p>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Darker is more direct sun · {worst.name} is the binding case at {worst.mean.toFixed(1)} h, and that is
        the season people complain about
      </p>
    </div>
  );
}
