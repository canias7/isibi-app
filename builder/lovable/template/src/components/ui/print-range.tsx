import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Which pages to print.
 *
 * IT ACCEPTS THE NOTATION PEOPLE ALREADY KNOW — "1-3, 7, 9-" — because that is
 * what every print dialog has taught them for thirty years, and a pair of from
 * and to boxes cannot express it.
 *
 * THE PARSED RESULT IS ECHOED BACK as a page count. "1-3, 7, 9-" is easy to get
 * subtly wrong, and "12 pages" confirms the intent before paper is used.
 *
 * INVALID INPUT NARROWS RATHER THAN THROWS. A range beyond the document is
 * clamped and a malformed chunk ignored, because refusing to print at all over a
 * stray comma is worse than printing the pages that were understood.
 */
export function parseRange(input: string, total: number): number[] {
  const out = new Set<number>();
  for (const chunk of input.split(",")) {
    const t = chunk.trim();
    if (!t) continue;
    const m = /^(\d+)?\s*-\s*(\d+)?$/.exec(t);
    if (m) {
      const from = Math.max(Number(m[1] ?? 1), 1);
      const to = Math.min(Number(m[2] ?? total), total);
      for (let i = from; i <= to; i++) out.add(i);
    } else if (/^\d+$/.test(t)) {
      const n = Number(t);
      if (n >= 1 && n <= total) out.add(n);
    }
  }
  return [...out].sort((a, b) => a - b);
}

export function PrintRange({ value, onChange, total, id, className }: {
  value: string;
  onChange: (v: string) => void;
  total: number;
  id?: string;
  className?: string;
}) {
  const auto = React.useId();
  const fieldId = id ?? auto;
  const pages = value.trim() ? parseRange(value, total) : [];
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={fieldId} className="text-sm font-medium">Pages</label>
      <input id={fieldId} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={`1-${total}`} inputMode="numeric"
        aria-describedby={`${fieldId}-note`}
        className="h-9 w-40 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
      <p id={`${fieldId}-note`} role="status" className="text-xs text-muted-foreground tabular-nums">
        {value.trim()
          ? pages.length
            ? `${pages.length} of ${total} pages`
            : "Nothing matches — try 1-3, 7"
          : `All ${total} pages`}
      </p>
    </div>
  );
}
