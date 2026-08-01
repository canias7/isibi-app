import { cn } from "@/lib/utils";
/**
 * Who last touched each line.
 *
 * CONSECUTIVE LINES BY THE SAME PERSON SHOW THE NAME ONCE. Repeating it down
 * forty rows is the thing that makes a blame view unreadable — the eye is
 * scanning for the CHANGE of author, and printing the same name forty times
 * hides exactly that.
 *
 * The gutter is `aria-hidden` and each line carries the attribution in
 * `sr-only` text instead. A screen reader reading a two-column table of names
 * against code gets neither the code nor the names; reading "line 12, Sam:
 * const total" gets both, in the order that makes sense.
 *
 * Monospace and `whitespace-pre` on the content, because this is almost always
 * code or structured text and reflowing it destroys the only alignment it has.
 */
export type BlameLine = { text: string; by: string; when?: string };

export function BlameGutter({ lines, startLine = 1, className }: {
  lines: BlameLine[];
  startLine?: number;
  className?: string;
}) {
  if (!lines.length) return null;
  return (
    <ol className={cn("overflow-x-auto rounded-md border border-border font-mono text-xs", className)}>
      {lines.map((l, i) => {
        const same = i > 0 && lines[i - 1].by === l.by;
        return (
          <li key={i} className="flex gap-3 px-3 py-0.5">
            <span aria-hidden
              className={cn("w-28 shrink-0 truncate", same ? "text-transparent" : "text-muted-foreground")}>
              {l.by}
            </span>
            <span aria-hidden className="w-8 shrink-0 text-right text-muted-foreground tabular-nums">
              {startLine + i}
            </span>
            <span className="whitespace-pre">
              <span className="sr-only">Line {startLine + i}, {l.by}{l.when ? `, ${l.when}` : ""}: </span>
              {l.text}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
