/** Networks and security operations. */
import type { ReactNode } from "react";

const TONE = "var(--foreground)";

/* ------------------------------------------------------------------ traceroute */
/**
 * Latency per hop, with the INCREMENT each hop adds.
 *
 * Cumulative latency alone makes every hop after a bad one look bad; the
 * increment is what identifies which link is the problem.
 */
export function Traceroute({
  hops, height = 230, label,
}: {
  hops: { n: number; host: string; ms: number | null; asn?: string }[]; height?: number; label?: string;
}) {
  if (!hops.length) return null;
  let prev = 0;
  const rows = hops.map((h) => {
    const inc = h.ms == null ? null : Math.max(0, h.ms - prev);
    if (h.ms != null) prev = h.ms;
    return { ...h, inc };
  });
  const max = Math.max(...rows.map((r) => r.ms ?? 0), 1);
  const worst = rows.filter((r) => r.inc != null).reduce((a, b) => ((b.inc ?? 0) > (a.inc ?? 0) ? b : a));
  const lost = rows.filter((r) => r.ms == null).length;

  return (
    <div className="w-full">
      <div className="space-y-[3px]" style={{ minHeight: height }}>
        {rows.map((r) => (
          <div key={r.n} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-right text-[9px] tabular-nums text-muted-foreground">{r.n}</span>
            <span className="w-[34%] shrink-0 truncate font-mono text-[10px]">
              {r.host}{r.asn ? <span className="text-muted-foreground"> {r.asn}</span> : null}
            </span>
            <div className="relative h-3 flex-1">
              {r.ms == null ? (
                <span className="text-[9px] text-muted-foreground">* * *</span>
              ) : (
                <>
                  <span className="absolute top-0 bottom-0 left-0 rounded-[2px]" style={{ width: `${(r.ms / max) * 100}%`, background: TONE, opacity: 0.28 }} />
                  <span className="absolute top-0 bottom-0 rounded-[2px]" style={{
                    left: `${((r.ms - (r.inc ?? 0)) / max) * 100}%`,
                    width: `${((r.inc ?? 0) / max) * 100}%`, background: TONE,
                  }} />
                </>
              )}
            </div>
            <span className="w-16 shrink-0 text-right text-[9px] tabular-nums text-muted-foreground">
              {r.ms == null ? "no reply" : `${r.ms.toFixed(1)} ms`}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Solid is what THIS hop adds, pale is the total so far · hop {worst.n} ({worst.host}) adds the most
        at {(worst.inc ?? 0).toFixed(1)} ms{lost ? ` · ${lost} hop${lost === 1 ? "" : "s"} did not reply, which is usually a filter, not a fault` : ""}
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- attack tree */
type AttackNode = { goal: string; kind?: "and" | "or"; cost?: number; children?: AttackNode[] };

/**
 * Ways to reach an objective, with AND and OR nodes.
 *
 * The CHEAPEST path is computed — min across an OR, sum across an AND — which
 * is the whole point: an attacker takes the easiest route, not the average one.
 */
export function AttackTree({ root, label }: { root: AttackNode; label?: string }) {
  const cost = (n: AttackNode): number => {
    if (!n.children?.length) return n.cost ?? 0;
    const kids = n.children.map(cost);
    return n.kind === "and" ? kids.reduce((a, b) => a + b, 0) : Math.min(...kids);
  };
  const cheapest = cost(root);
  // Scale against the dearest node, not the root: the root IS the cheapest
  // route, so root*4 clipped every expensive branch to the same full bar.
  const all: number[] = [];
  const collect = (n: AttackNode) => { all.push(cost(n)); n.children?.forEach(collect); };
  collect(root);
  const dearest = Math.max(...all, 1);

  const render = (n: AttackNode, depth: number, key: string): ReactNode[] => {
    const c = cost(n);
    const onPath = c === cheapest || depth === 0;
    return [
      <div key={key} className="flex items-center gap-2 py-[1px]" style={{ paddingLeft: depth * 14 }}>
        <span className="w-[52%] shrink-0 truncate text-[10px]" style={{ fontWeight: onPath ? 600 : 400 }}>
          {depth > 0 ? "└ " : ""}{n.goal}
          {n.children?.length ? <span className="text-muted-foreground"> ({n.kind === "and" ? "all of" : "any of"})</span> : null}
        </span>
        <div className="relative h-2.5 flex-1 rounded-[2px]" style={{ background: "var(--muted)" }}>
          <span className="absolute top-0 bottom-0 left-0 rounded-[2px]"
            style={{ width: `${Math.max(2, (c / dearest) * 100)}%`, background: TONE, opacity: onPath ? 1 : 0.4 }} />
        </div>
        <span className="w-12 shrink-0 text-right text-[9px] tabular-nums text-muted-foreground">{c}</span>
      </div>,
      ...(n.children ?? []).flatMap((k, i) => render(k, depth + 1, `${key}-${i}`)),
    ];
  };

  return (
    <div className="w-full">
      <div>{render(root, 0, "r")}</div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Cost is min across "any of", sum across "all of" · the cheapest route in is {cheapest} —
        that is the number defending changes, not the average
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ kill chain */
/**
 * Stages of an intrusion with what stopped it and what did not.
 *
 * The EARLIEST stage with a control is called out, because every later
 * detection means the attacker already got that far.
 */
export function KillChain({
  stages, label,
}: {
  stages: { name: string; observed: boolean; detected: boolean; blocked: boolean; at?: string }[]; label?: string;
}) {
  if (!stages.length) return null;
  const firstBlock = stages.findIndex((s) => s.blocked);
  const reached = stages.filter((s) => s.observed).length;

  return (
    <div className="w-full">
      {/* Wraps rather than scrolls: a chain that runs off the edge hides the
          stages an intrusion actually reached, which is the whole message. */}
      <div className="flex flex-wrap gap-1">
        {stages.map((s, i) => (
          <div key={s.name} className="min-w-[66px] flex-1 rounded-[3px] p-1.5"
            style={{
              background: s.blocked ? TONE : s.observed ? "var(--muted)" : "var(--background)",
              color: s.blocked ? "var(--background)" : "var(--foreground)",
              border: s.observed && !s.blocked ? undefined : `1px solid ${s.blocked ? TONE : "var(--border)"}`,
              opacity: s.observed ? 1 : 0.55,
            }}>
            <div className="text-[9px] font-semibold leading-tight">{i + 1}. {s.name}</div>
            <div className="mt-0.5 text-[14px] leading-none">
              {s.blocked ? "■" : s.detected ? "◐" : s.observed ? "○" : "·"}
            </div>
            {s.at ? <div className="mt-0.5 text-[8px] opacity-75">{s.at}</div> : null}
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        ■ blocked · ◐ detected only · ○ observed, no control · · not seen ·
        {firstBlock >= 0
          ? ` first block at stage ${firstBlock + 1}, so the attacker completed ${firstBlock} stage${firstBlock === 1 ? "" : "s"} first`
          : ` nothing blocked it — it reached ${reached} of ${stages.length} stages`}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- CVE severity */
/**
 * Vulnerabilities by severity and whether a fix exists.
 *
 * "Critical" alone is not a work queue — a critical with no patch available is
 * a different job from a critical sitting unapplied — so both are separated.
 */
export function CveSeverity({
  buckets, label,
}: {
  buckets: { severity: string; patched: number; patchAvailable: number; noFix: number }[]; label?: string;
}) {
  if (!buckets.length) return null;
  const rows = buckets.map((b) => ({ ...b, total: b.patched + b.patchAvailable + b.noFix }));
  const max = Math.max(...rows.map((r) => r.total));
  const actionable = rows.reduce((s, r) => s + r.patchAvailable, 0);

  return (
    <div className="w-full space-y-1.5">
      {rows.map((r, i) => (
        <div key={r.severity}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-medium">{r.severity}</span>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.patchAvailable} waiting · {r.noFix} no fix · {r.patched} done
            </span>
          </div>
          <div className="mt-0.5 flex h-4 overflow-hidden rounded-[2px]" style={{ width: `${(r.total / max) * 100}%` }}>
            <span style={{ width: `${(r.patchAvailable / r.total) * 100}%`, background: TONE }} title="patch available, not applied" />
            <span style={{
              width: `${(r.noFix / r.total) * 100}%`, background: "var(--background)",
              boxShadow: `inset 0 0 0 1.5px ${TONE}`,
            }} title="no fix available" />
            <span style={{ width: `${(r.patched / r.total) * 100}%`, background: TONE, opacity: 0.2 - i * 0.01 }} title="patched" />
          </div>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Solid is a patch waiting to be applied, outlined has no fix yet, pale is done ·
        {actionable} are actionable today
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- patch latency */
/** Days from disclosure to deployment, as a distribution against the SLA. */
export function PatchLatency({
  items, slaDays, height = 220, label,
}: {
  items: { cve: string; days: number; severity?: string }[]; slaDays: number; height?: number; label?: string;
}) {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => a.days - b.days);
  const max = Math.max(...sorted.map((i) => i.days), slaDays) * 1.08;
  const breached = sorted.filter((i) => i.days > slaDays);
  const median = sorted[Math.floor(sorted.length / 2)].days;

  return (
    <div className="w-full">
      <div className="relative flex items-end gap-[2px]" style={{ height }}>
        {sorted.map((i) => (
          <div key={i.cve} className="flex-1" title={`${i.cve}: ${i.days} days`}
            style={{
              height: `${(i.days / max) * 100}%`,
              background: i.days > slaDays ? "var(--background)" : TONE,
              border: i.days > slaDays ? `1.5px solid ${TONE}` : undefined,
            }} />
        ))}
        <div className="pointer-events-none absolute right-0 left-0 border-t-2 border-dashed border-foreground"
          style={{ bottom: `${(slaDays / max) * 100}%` }}>
          <span className="absolute -top-4 right-0 text-[10px]">{slaDays}-day SLA</span>
        </div>
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        One bar per vulnerability, sorted · median {median} days ·
        {breached.length} of {items.length} outside the SLA (outlined)
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- bandwidth stack */
/** Traffic by protocol over time, stacked, with the link capacity drawn. */
export function BandwidthStack({
  samples, protocols, capacityMbps, height = 240, label,
}: {
  /** samples[i].values[protocolIndex] in Mbps */ samples: { t: string; values: number[] }[];
  protocols: string[]; capacityMbps: number; height?: number; label?: string;
}) {
  if (!samples.length) return null;
  const totals = samples.map((s) => s.values.reduce((a, b) => a + b, 0));
  const max = Math.max(capacityMbps, ...totals) * 1.06;
  const peak = Math.max(...totals);
  const overSubscribed = totals.filter((t) => t > capacityMbps * 0.9).length;

  return (
    <div className="w-full">
      <div className="relative flex items-end" style={{ height }}>
        {samples.map((s, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end" title={s.t}>
            {[...s.values].map((v, pi) => (
              <span key={pi} style={{
                height: `${(v / max) * 100}%`,
                background: `color-mix(in oklch, ${TONE} ${Math.round(90 - (pi / Math.max(1, protocols.length - 1)) * 62)}%, transparent)`,
                order: pi,
              }} />
            ))}
          </div>
        ))}
        <div className="pointer-events-none absolute right-0 left-0 border-t-2 border-dashed border-foreground"
          style={{ bottom: `${(capacityMbps / max) * 100}%` }} />
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {protocols.map((p, i) => (
          <span key={p} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: `color-mix(in oklch, ${TONE} ${Math.round(90 - (i / Math.max(1, protocols.length - 1)) * 62)}%, transparent)` }} />{p}
          </span>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Dashed is the {capacityMbps.toLocaleString()} Mbps link · peak {Math.round(peak).toLocaleString()} Mbps
        ({Math.round((peak / capacityMbps) * 100)}%) · within 10% of capacity in {overSubscribed} of {samples.length} samples
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- port scan */
/** Open, closed and filtered ports per host — a filtered port is not a closed one. */
export function PortScan({
  hosts, ports, /** grid[host][port] */ grid, label,
}: {
  hosts: string[]; ports: number[]; grid: ("open" | "closed" | "filtered")[][]; label?: string;
}) {
  if (!hosts.length || !ports.length) return null;
  const count = (k: "open" | "closed" | "filtered") => grid.flat().filter((v) => v === k).length;
  const GLYPH = { open: "■", closed: "·", filtered: "▨" } as const;

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `auto repeat(${ports.length}, minmax(26px, 1fr))` }}>
        <span />
        {ports.map((p) => <span key={p} className="pb-0.5 text-center text-[9px] text-muted-foreground">{p}</span>)}
        {hosts.map((h, hi) => (
          <div key={h} className="contents">
            <span className="self-center pr-1.5 font-mono text-[10px] whitespace-nowrap">{h}</span>
            {ports.map((p, pi) => {
              const v = grid[hi]?.[pi] ?? "closed";
              return (
                <span key={p} className="flex aspect-square items-center justify-center text-[11px]"
                  style={{
                    background: v === "open" ? TONE : v === "filtered" ? "var(--muted)" : "var(--background)",
                    color: v === "open" ? "var(--background)" : "var(--muted-foreground)",
                    outline: "1px solid var(--border)", outlineOffset: -1,
                  }}
                  title={`${h}:${p} ${v}`}>{GLYPH[v]}</span>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        ■ open · ▨ filtered · · closed — filtered means something dropped the probe, which is NOT the same as
        closed and often means a firewall in front of a live service ·
        {count("open")} open, {count("filtered")} filtered across {hosts.length} hosts
      </p>
    </div>
  );
}
