import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A scrolling log with a level filter and a search.
 *
 * It FOLLOWS THE TAIL only while you are at the bottom, the same rule
 * `transcript-view` follows and for the same reason: a log that jumps to the
 * end on every new line makes reading the error you just found impossible.
 *
 * Levels are told apart by a LETTER in a fixed-width column — E, W, I, D — not
 * by colour. It scans as well as a colour does and it survives being copied
 * into a bug report, which is where these lines usually end up.
 *
 * The filter says how many lines it is HIDING. A log filtered to errors that
 * shows nothing is ambiguous between "no errors" and "the filter is wrong", and
 * that ambiguity is expensive at three in the morning.
 *
 * The search query is escaped before it becomes a regex — an unescaped bracket
 * throws, and somebody debugging is very likely to paste one in. Same guard as
 * `highlight-match`.
 */
const LETTER = { error: "E", warn: "W", info: "I", debug: "D" } as const;

export function LogViewer({ lines, className }: {
  lines: { id: string | number; at?: string; level?: keyof typeof LETTER; text: string; source?: string }[];
  className?: string;
}) {
  const [level, setLevel] = React.useState<"all" | keyof typeof LETTER>("all");
  const [q, setQ] = React.useState("");
  const box = React.useRef<HTMLDivElement>(null);
  const follow = React.useRef(true);

  const shown = React.useMemo(() => {
    const needle = q.toLowerCase();
    return lines.filter((l) =>
      (level === "all" || l.level === level) &&
      (!needle || l.text.toLowerCase().includes(needle) || (l.source ?? "").toLowerCase().includes(needle)));
  }, [lines, level, q]);
  const hidden = lines.length - shown.length;

  React.useEffect(() => {
    const el = box.current;
    if (el && follow.current) el.scrollTop = el.scrollHeight;
  }, [shown.length]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 start-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" aria-label="Filter the log"
            className="h-8 w-full rounded-md border border-border bg-background pe-7 ps-7 font-mono text-xs outline-none focus-visible:border-ring" />
          {q ? (
            <button type="button" onClick={() => setQ("")} aria-label="Clear filter"
              className="absolute top-1/2 end-1.5 cursor-pointer -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
              <X aria-hidden className="size-3" />
            </button>
          ) : null}
        </div>
        <div className="flex gap-1">
          {(["all", "error", "warn", "info", "debug"] as const).map((l) => (
            <button key={l} type="button" onClick={() => setLevel(l)} aria-pressed={level === l}
              className={cn("cursor-pointer rounded px-2 py-1 text-xs",
                level === l ? "bg-foreground text-background" : "hover:bg-muted")}>
              {l === "all" ? "All" : l}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={box}
        onScroll={() => {
          const el = box.current;
          if (el) follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
        className="h-56 overflow-auto rounded-md border border-border bg-muted/30 [overflow-anchor:none]"
      >
        <table className="w-full border-collapse font-mono text-xs">
          <tbody>
            {shown.map((l) => (
              <tr key={l.id} className="align-top hover:bg-muted/60">
                {l.at ? <td className="px-2 py-0.5 whitespace-nowrap text-muted-foreground tabular-nums">{l.at}</td> : null}
                <td className="w-5 py-0.5 text-center font-semibold">
                  <span aria-hidden>{l.level ? LETTER[l.level] : ""}</span>
                  <span className="sr-only">{l.level ?? ""}</span>
                </td>
                {l.source ? <td className="px-2 py-0.5 whitespace-nowrap text-muted-foreground">{l.source}</td> : null}
                <td className="px-2 py-0.5 whitespace-pre-wrap">{l.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">Nothing matches.</p>
        ) : null}
      </div>

      <p aria-live="polite" className="text-xs text-muted-foreground tabular-nums">
        {shown.length.toLocaleString()} {shown.length === 1 ? "line" : "lines"}
        {hidden > 0 ? ` · ${hidden.toLocaleString()} hidden by the filter` : null}
      </p>
    </div>
  );
}
