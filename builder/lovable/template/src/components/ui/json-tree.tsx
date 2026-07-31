import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Expandable JSON.
 *
 * A collapsed node shows its SIZE — `{…} 4 keys`, `[…] 128 items`. A bare `{…}`
 * gives no reason to open it or not, and on a response with thirty collapsed
 * objects that is thirty coin flips.
 *
 * Big arrays are TRUNCATED with a "show the rest" button. A 5,000-element array
 * expanded is 5,000 DOM nodes and a locked tab, which is the standard way a
 * JSON viewer takes a page down.
 *
 * Depth is bounded on the way in, and a CYCLE is caught rather than recursed
 * into — a self-referential object is not exotic in a debugging panel, and
 * without the check it is an immediate stack overflow.
 *
 * `null`, `""`, `0` and `false` are rendered distinctly and never as blanks:
 * telling those four apart is most of what anyone opens a JSON viewer to do.
 */
function summary(v: unknown): string {
  if (Array.isArray(v)) return `[…] ${v.length} ${v.length === 1 ? "item" : "items"}`;
  const n = Object.keys(v as object).length;
  return `{…} ${n} ${n === 1 ? "key" : "keys"}`;
}

function Leaf({ value }: { value: unknown }) {
  if (value === null) return <span className="text-muted-foreground italic">null</span>;
  if (value === undefined) return <span className="text-muted-foreground italic">undefined</span>;
  if (typeof value === "string") return <span className="italic">&quot;{value}&quot;</span>;
  if (typeof value === "boolean") return <span className="font-semibold">{String(value)}</span>;
  if (typeof value === "number") return <span className="tabular-nums underline decoration-dotted underline-offset-2">{String(value)}</span>;
  return <span>{String(value)}</span>;
}

function Node({ name, value, depth, maxDepth, seen, chunk }: {
  name?: string; value: unknown; depth: number; maxDepth: number; seen: Set<object>; chunk: number;
}) {
  const isObj = value !== null && typeof value === "object";
  const [open, setOpen] = React.useState(depth < 1);
  const [limit, setLimit] = React.useState(chunk);

  if (!isObj) {
    return (
      <div className="flex gap-1.5 py-px pl-4 font-mono text-xs">
        {name != null ? <span className="text-muted-foreground">{name}:</span> : null}
        <Leaf value={value} />
      </div>
    );
  }
  if (seen.has(value as object)) {
    return (
      <div className="py-px pl-4 font-mono text-xs text-muted-foreground">
        {name != null ? `${name}: ` : ""}(circular reference)
      </div>
    );
  }
  if (depth >= maxDepth) {
    return (
      <div className="py-px pl-4 font-mono text-xs text-muted-foreground">
        {name != null ? `${name}: ` : ""}{summary(value)} — too deep to show
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);
  const next = new Set(seen);
  next.add(value as object);

  return (
    <div className="font-mono text-xs">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-1 rounded py-px text-left hover:bg-muted">
        <ChevronRight aria-hidden className={cn("size-3 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
        {name != null ? <span className="text-muted-foreground">{name}:</span> : null}
        {!open ? <span className="text-muted-foreground">{summary(value)}</span> : null}
      </button>
      {open ? (
        <div className="border-l border-border pl-2">
          {entries.slice(0, limit).map(([k, v]) => (
            <Node key={k} name={k} value={v} depth={depth + 1} maxDepth={maxDepth} seen={next} chunk={chunk} />
          ))}
          {entries.length > limit ? (
            <button type="button" onClick={() => setLimit((n) => n + chunk)}
              className="cursor-pointer py-px pl-4 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
              Show {Math.min(chunk, entries.length - limit)} more of {entries.length}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function JsonTree({ data, maxDepth = 8, chunk = 50, className }: {
  data: unknown;
  maxDepth?: number;
  chunk?: number;
  className?: string;
}) {
  return (
    <div className={cn("overflow-auto rounded-md border border-border p-2", className)}>
      <Node value={data} depth={0} maxDepth={maxDepth} seen={new Set()} chunk={chunk} />
    </div>
  );
}
