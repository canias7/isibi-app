import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A unified diff.
 *
 * The `+` and `-` are REAL CHARACTERS in the markup, not a background tint.
 * Red-and-green is how every diff viewer marks changes and it says nothing in
 * greyscale, in print, or to the ~8% of men who cannot separate those two hues
 * — and a diff is precisely where getting the direction backwards is
 * expensive. The markers also survive copy and paste, which a background does
 * not.
 *
 * BOTH line numbers are shown, old and new, and a line missing from one side
 * has a blank there. One column of numbers is ambiguous about which file it
 * refers to, and that is the question somebody has when they go to open the
 * file and find the change.
 *
 * Unchanged CONTEXT is dimmed but present. A diff of only the changed lines is
 * unreadable — the whole skill of reading one is seeing what surrounds the
 * change.
 *
 * The `@@` hunk header is kept verbatim. It is ugly and it is the one line that
 * says where in the file this is.
 */
export type DiffLine = { kind: "add" | "del" | "ctx" | "hunk"; text: string; oldNo?: number; newNo?: number };

/** Split a unified-diff string into lines, keeping the numbers straight. */
export function parseUnifiedDiff(diff: string): DiffLine[] {
  const out: DiffLine[] = [];
  let oldNo = 0, newNo = 0;
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("@@")) {
      const m = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (m) { oldNo = Number(m[1]); newNo = Number(m[2]); }
      out.push({ kind: "hunk", text: raw });
    } else if (raw.startsWith("+")) {
      out.push({ kind: "add", text: raw.slice(1), newNo: newNo++ });
    } else if (raw.startsWith("-")) {
      out.push({ kind: "del", text: raw.slice(1), oldNo: oldNo++ });
    } else {
      out.push({ kind: "ctx", text: raw.replace(/^ /, ""), oldNo: oldNo++, newNo: newNo++ });
    }
  }
  return out;
}

export function CodeDiff({ lines, filename, className }: {
  lines: DiffLine[];
  filename?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-md border border-border", className)}>
      {filename ? (
        <p className="border-b border-border bg-muted px-3 py-1.5 font-mono text-xs">{filename}</p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono text-xs">
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className={cn(l.kind === "hunk" && "bg-muted/60")}>
                <td className="w-10 border-e border-border px-2 text-end align-top text-muted-foreground tabular-nums select-none">
                  {l.oldNo ?? ""}
                </td>
                <td className="w-10 border-e border-border px-2 text-end align-top text-muted-foreground tabular-nums select-none">
                  {l.newNo ?? ""}
                </td>
                <td className={cn("px-2 whitespace-pre-wrap",
                  l.kind === "add" && "bg-muted font-medium",
                  l.kind === "del" && "bg-muted/50 text-muted-foreground",
                  l.kind === "ctx" && "text-muted-foreground",
                  l.kind === "hunk" && "text-muted-foreground")}>
                  <span aria-hidden className="inline-block w-3 select-none">
                    {l.kind === "add" ? "+" : l.kind === "del" ? "-" : ""}
                  </span>
                  <span className="sr-only">
                    {l.kind === "add" ? "added: " : l.kind === "del" ? "removed: " : ""}
                  </span>
                  {l.text}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
