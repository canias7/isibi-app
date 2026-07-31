/** Database and service internals — what you open when a query goes slow. */
import type { ReactNode } from "react";

const TONE = "var(--foreground)";

/* ------------------------------------------------------------------ query plan */
type PlanNode = { op: string; rows: number; ms: number; detail?: string; children?: PlanNode[] };

/**
 * An execution plan as a tree, with SELF time separated from total.
 *
 * A node's own cost is total minus its children's — a plan showing only
 * inclusive time makes the root look like the problem on every query.
 */
export function QueryPlan({ root, label }: { root: PlanNode; label?: string }) {
  const total = root.ms || 1;
  const selfMs = (n: PlanNode): number => n.ms - (n.children ?? []).reduce((s, c) => s + c.ms, 0);
  let worst = { op: root.op, self: selfMs(root) };
  const scan = (n: PlanNode) => {
    const s = selfMs(n);
    if (s > worst.self) worst = { op: n.op, self: s };
    n.children?.forEach(scan);
  };
  scan(root);

  const row = (n: PlanNode, depth: number, key: string): ReactNode[] => {
    const self = selfMs(n);
    return [
      <div key={key} className="flex items-center gap-2 py-[1px]" style={{ paddingLeft: depth * 12 }}>
        <span className="w-[42%] shrink-0 truncate text-[10px]">
          {depth > 0 ? "└ " : ""}{n.op}
          {n.detail ? <span className="text-muted-foreground"> {n.detail}</span> : null}
        </span>
        <div className="relative h-3 flex-1 rounded-[2px]" style={{ background: "var(--muted)" }}>
          <span className="absolute top-0 bottom-0 left-0 rounded-[2px]" style={{ width: `${(n.ms / total) * 100}%`, background: TONE, opacity: 0.28 }} />
          <span className="absolute top-0 bottom-0 left-0 rounded-[2px]" style={{ width: `${(self / total) * 100}%`, background: TONE }} />
        </div>
        <span className="w-20 shrink-0 text-right text-[9px] tabular-nums text-muted-foreground">
          {n.rows.toLocaleString()} rows · {self.toFixed(1)}ms
        </span>
      </div>,
      ...(n.children ?? []).flatMap((c, i) => row(c, depth + 1, `${key}-${i}`)),
    ];
  };

  return (
    <div className="w-full">
      <div className="space-y-0">{row(root, 0, "r")}</div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Solid is the node's OWN time, pale is inclusive · {worst.op} costs the most on its own
        ({worst.self.toFixed(1)}ms of {total.toFixed(1)}ms)
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ index usage */
/**
 * Scans per index against the write cost of keeping it.
 *
 * An unused index is not free — it slows every insert — so a list of scan
 * counts alone never justifies dropping one. Both sides are shown.
 */
export function IndexUsage({
  indexes, label,
}: {
  indexes: { name: string; scans: number; sizeMb: number; writesPerMin: number }[]; label?: string;
}) {
  if (!indexes.length) return null;
  const rows = [...indexes].sort((a, b) => a.scans - b.scans);
  const maxScans = Math.max(...rows.map((r) => r.scans), 1);
  const maxSize = Math.max(...rows.map((r) => r.sizeMb));
  const dead = rows.filter((r) => r.scans === 0);
  const wasted = dead.reduce((s, r) => s + r.sizeMb, 0);

  return (
    <div className="w-full">
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.name}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-mono text-[10px]">{r.name}</span>
              <span className="text-[9px] tabular-nums text-muted-foreground">
                {r.scans.toLocaleString()} scans · {r.sizeMb} MB · {r.writesPerMin}/min maintained
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1">
              <span className="h-2.5 rounded-[2px]" style={{ width: `${(r.scans / maxScans) * 58}%`, background: TONE }} />
              <span className="h-2.5 rounded-[2px]" style={{
                width: `${(r.sizeMb / maxSize) * 26}%`, background: TONE,
                backgroundImage: "repeating-linear-gradient(45deg, transparent 0 2px, var(--background) 2px 3px)",
              }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Solid is reads, hatched is the space it occupies ·
        {dead.length ? ` ${dead.length} never scanned, holding ${wasted} MB and slowing every write` : " every index is being read"}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------- lock wait */
/** Who is blocking whom, as a wait chain with the root blocker at the head. */
export function LockWait({
  chains, label,
}: {
  chains: { pid: number; query: string; waitingMs: number; blockedBy?: number }[]; label?: string;
}) {
  if (!chains.length) return null;
  const byPid = new Map(chains.map((c) => [c.pid, c]));
  const depth = (c: (typeof chains)[number], seen = new Set<number>()): number => {
    if (c.blockedBy == null || seen.has(c.pid)) return 0;
    seen.add(c.pid);
    const parent = byPid.get(c.blockedBy);
    return parent ? 1 + depth(parent, seen) : 0;
  };
  const rows = [...chains].sort((a, b) => depth(a) - depth(b) || b.waitingMs - a.waitingMs);
  const roots = chains.filter((c) => c.blockedBy == null);
  const max = Math.max(...chains.map((c) => c.waitingMs), 1);

  return (
    <div className="w-full">
      <div className="space-y-1">
        {rows.map((c) => {
          const d = depth(c);
          return (
            <div key={c.pid} className="flex items-center gap-2" style={{ paddingLeft: d * 14 }}>
              <span className="w-10 shrink-0 text-[9px] tabular-nums text-muted-foreground">{d ? "└ " : ""}{c.pid}</span>
              <span className="w-[38%] shrink-0 truncate font-mono text-[10px]">{c.query}</span>
              <span className="h-3 rounded-[2px]" style={{
                width: `${(c.waitingMs / max) * 34}%`,
                background: c.blockedBy == null ? "var(--background)" : TONE,
                border: c.blockedBy == null ? `2px solid ${TONE}` : undefined,
              }} />
              <span className="text-[9px] tabular-nums text-muted-foreground">
                {c.blockedBy == null ? "holding" : `${(c.waitingMs / 1000).toFixed(1)}s`}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Outlined at the head is the root blocker — {roots.map((r) => r.pid).join(", ")} · killing that one frees the chain
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- replica lag */
/** Lag per replica against the alert threshold, on a log axis. */
export function ReplicationLag({
  series, thresholdSec, height = 230, label,
}: {
  series: { replica: string; points: { t: string; lagSec: number }[] }[]; thresholdSec: number;
  height?: number; label?: string;
}) {
  if (!series.length) return null;
  const all = series.flatMap((s) => s.points.map((p) => Math.max(0.01, p.lagSec)));
  const hi = Math.max(...all, thresholdSec) * 1.6, lo = Math.min(...all) * 0.6;
  const n = Math.max(...series.map((s) => s.points.length));
  const x = (i: number) => (i / Math.max(1, n - 1)) * 100;
  const y = (v: number) => 100 - ((Math.log10(Math.max(0.01, v)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * 100;
  const dashes = ["", "5 3", "2 2", "7 2 2 2"];
  const breached = series.filter((s) => s.points.some((p) => p.lagSec > thresholdSec));

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `${breached.length} replicas over ${thresholdSec}s`}>
        <line x1={0} y1={y(thresholdSec)} x2={100} y2={y(thresholdSec)}
          stroke={TONE} strokeWidth={1.4} strokeDasharray="5 3" strokeOpacity={0.65} vectorEffect="non-scaling-stroke" />
        {series.map((s, i) => (
          <polyline key={s.replica} points={s.points.map((p, j) => `${x(j)},${y(p.lagSec)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={1.6} strokeDasharray={dashes[i % dashes.length] || undefined} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
        {series.map((s, i) => (
          <span key={s.replica} className="flex items-center gap-1">
            <svg width="16" height="4"><line x1={0} y1={2} x2={16} y2={2} stroke={TONE} strokeWidth={1.6} strokeDasharray={dashes[i % dashes.length] || undefined} /></svg>{s.replica}
          </span>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Log axis — lag goes from milliseconds to minutes and a linear one shows only the incident ·
        {breached.length ? ` ${breached.map((s) => s.replica).join(", ")} crossed ${thresholdSec}s` : ` nothing crossed ${thresholdSec}s`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- partition skew */
/**
 * Rows per partition against the even share.
 *
 * Skew is what makes one shard the whole latency story, so the ratio of the
 * biggest to the mean is computed rather than left to be eyeballed.
 */
export function PartitionSkew({
  partitions, height = 210, label,
}: {
  partitions: { key: string; rows: number }[]; height?: number; label?: string;
}) {
  if (!partitions.length) return null;
  const total = partitions.reduce((s, p) => s + p.rows, 0);
  const even = total / partitions.length;
  const max = Math.max(...partitions.map((p) => p.rows));
  const hottest = partitions.reduce((a, b) => (b.rows > a.rows ? b : a));

  return (
    <div className="w-full">
      <div className="relative flex items-end gap-[2px]" style={{ height }}>
        {partitions.map((p) => (
          <div key={p.key} className="flex-1" title={`${p.key}: ${p.rows.toLocaleString()}`}
            style={{
              height: `${(p.rows / max) * 100}%`,
              background: p.rows > even * 2 ? TONE : `color-mix(in oklch, ${TONE} 40%, transparent)`,
            }} />
        ))}
        <div className="pointer-events-none absolute right-0 left-0 border-t border-dashed border-foreground"
          style={{ bottom: `${(even / max) * 100}%` }} />
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Dashed is an even split · {hottest.key} holds {Math.round((hottest.rows / even) * 10) / 10}× the average
        ({Math.round((hottest.rows / total) * 100)}% of all rows in one of {partitions.length})
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- cache hit */
/**
 * Hit rate against the cost of a miss.
 *
 * Effective latency is COMPUTED, because a 95% hit rate sounds fine and is
 * terrible when a miss costs 200× a hit — which is the only thing worth
 * knowing here.
 */
export function CacheHitRate({
  tiers, height = 220, label,
}: {
  tiers: { name: string; hitRate: number; hitMs: number; missMs: number }[]; height?: number; label?: string;
}) {
  if (!tiers.length) return null;
  const rows = tiers.map((t) => ({
    ...t, effective: t.hitRate * t.hitMs + (1 - t.hitRate) * t.missMs,
    penalty: t.missMs / (t.hitMs || 0.01),
  }));
  const max = Math.max(...rows.map((r) => r.effective));
  const worst = rows.reduce((a, b) => (b.effective > a.effective ? b : a));

  return (
    <div className="w-full">
      <div className="space-y-1.5" style={{ minHeight: height }}>
        {rows.map((r) => (
          <div key={r.name}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[10px] font-medium">{r.name}</span>
              <span className="text-[9px] tabular-nums text-muted-foreground">
                {(r.hitRate * 100).toFixed(1)}% hits · miss costs {Math.round(r.penalty)}×
              </span>
            </div>
            {/* Floored: effective latency spans three orders of magnitude here,
                and a purely proportional bar renders the fast tiers as nothing. */}
            <div className="mt-0.5 flex h-4 overflow-hidden rounded-[2px]" style={{ width: `${Math.max(4, (r.effective / max) * 100)}%` }}>
              <span style={{ width: `${((r.hitRate * r.hitMs) / r.effective) * 100}%`, background: TONE }} />
              <span style={{
                width: `${(((1 - r.hitRate) * r.missMs) / r.effective) * 100}%`, background: TONE,
                backgroundImage: "repeating-linear-gradient(45deg, transparent 0 2px, var(--background) 2px 3px)",
              }} />
            </div>
            <div className="text-[9px] tabular-nums text-muted-foreground">effective {r.effective.toFixed(2)} ms</div>
          </div>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        Bar length is effective latency, hatched is the part misses contribute ·
        {worst.name} spends {Math.round((((1 - worst.hitRate) * worst.missMs) / worst.effective) * 100)}% of its time on
        the {((1 - worst.hitRate) * 100).toFixed(1)}% that miss
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- connection pool */
/** In use, idle and waiting against the pool size, over time. */
export function ConnectionPool({
  samples, poolSize, height = 230, label,
}: {
  samples: { t: string; inUse: number; idle: number; waiting: number }[]; poolSize: number;
  height?: number; label?: string;
}) {
  if (!samples.length) return null;
  const max = Math.max(poolSize, ...samples.map((s) => s.inUse + s.idle + s.waiting)) * 1.05;
  const saturated = samples.filter((s) => s.waiting > 0).length;
  const peakWait = Math.max(...samples.map((s) => s.waiting));

  return (
    <div className="w-full">
      <div className="relative flex items-end" style={{ height }}>
        {samples.map((s, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end" title={s.t}>
            {s.waiting > 0 ? (
              <span style={{
                height: `${(s.waiting / max) * 100}%`, background: "var(--background)",
                border: `1.5px solid ${TONE}`, borderBottom: "none",
              }} />
            ) : null}
            <span style={{ height: `${(s.inUse / max) * 100}%`, background: TONE }} />
            <span style={{ height: `${(s.idle / max) * 100}%`, background: TONE, opacity: 0.25 }} />
          </div>
        ))}
        <div className="pointer-events-none absolute right-0 left-0 border-t-2 border-dashed border-foreground"
          style={{ bottom: `${(poolSize / max) * 100}%` }} />
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5" style={{ background: TONE }} />in use</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5" style={{ background: TONE, opacity: 0.25 }} />idle</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 border-2" style={{ borderColor: TONE }} />waiting</span>
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Dashed is the pool size of {poolSize} · anything outlined above it is a request queueing for a connection ·
        {saturated ? ` saturated in ${saturated} of ${samples.length} samples, peak queue ${peakWait}` : " never saturated"}
      </p>
    </div>
  );
}
