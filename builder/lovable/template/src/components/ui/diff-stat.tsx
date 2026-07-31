import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * `+128 −44` with the little bar.
 *
 * The bar is PROPORTIONAL WITHIN THE CHANGE, not against the file or the
 * repository. Five squares showing "mostly additions" is the entire message,
 * and scaling it against anything else makes every ordinary commit render as
 * five empty squares.
 *
 * Added and removed are told apart by FILL — solid against outlined — with the
 * `+` and `−` beside the numbers. Green and red is the universal convention and
 * it is the universal accessibility failure; here the signs already carry it,
 * so the bar only has to agree.
 *
 * The counts use `+` and `−` (a real minus sign, not a hyphen), and are
 * tabular, because these sit in a column in every list they appear in.
 *
 * A change of ZERO lines still renders, with an empty bar. That is a real thing
 * — a permissions change, a rename, an empty commit — and a component that
 * disappears makes it look like the data failed to load.
 */
export function DiffStat({ added = 0, removed = 0, files, squares = 5, className }: {
  added?: number;
  removed?: number;
  files?: number;
  squares?: number;
  className?: string;
}) {
  const total = Math.max(0, added) + Math.max(0, removed);
  const filled = total === 0 ? 0 : Math.max(1, Math.round((added / total) * squares));
  const empty = total === 0 ? 0 : squares - filled;

  return (
    <span className={cn("inline-flex items-center gap-2 text-xs", className)}>
      {files != null ? (
        <span className="text-muted-foreground tabular-nums">
          {files} {files === 1 ? "file" : "files"}
        </span>
      ) : null}
      <span className="font-medium tabular-nums">+{added.toLocaleString()}</span>
      <span className="text-muted-foreground tabular-nums">&minus;{removed.toLocaleString()}</span>
      <span aria-hidden className="inline-flex gap-0.5">
        {Array.from({ length: squares }, (_, i) => (
          <span key={i} className={cn("size-2 rounded-xs",
            i < filled ? "bg-foreground" : i < filled + empty ? "border border-foreground" : "bg-muted")} />
        ))}
      </span>
      <span className="sr-only">
        {added} added, {removed} removed{files != null ? ` across ${files} files` : ""}
      </span>
    </span>
  );
}
