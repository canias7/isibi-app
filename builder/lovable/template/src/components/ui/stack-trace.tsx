import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * An error and its frames, with the library noise folded away.
 *
 * FRAMES FROM DEPENDENCIES ARE COLLAPSED BY DEFAULT. A React error is forty
 * frames of which three are the application's, and the three are always in the
 * middle. Every debugger worth using has this, and it is the single thing that
 * turns a stack trace from a wall into an answer.
 *
 * They are collapsed, never removed, and the count is shown — because the
 * dependency frames matter exactly when the bug is in the dependency, and a
 * trace that silently dropped them would hide that entirely.
 *
 * A run of hidden frames is one row saying how many, in place, so the ORDER is
 * preserved. Filtering them out of the list instead makes two application
 * frames look adjacent when eleven library frames sit between them.
 *
 * `app` is decided by the CALLER, not guessed from the path here. What counts
 * as "ours" differs per project — a monorepo package under `node_modules` is
 * still yours — and a heuristic that gets it wrong hides the frame somebody
 * needs.
 */
export type Frame = { fn?: string; file: string; line?: number; column?: number; app?: boolean };

export function StackTrace({ error, message, frames, defaultExpanded, className }: {
  error?: React.ReactNode;
  message?: React.ReactNode;
  frames: Frame[];
  defaultExpanded?: boolean;
  className?: string;
}) {
  const [showAll, setShowAll] = React.useState(!!defaultExpanded);

  // Group consecutive non-app frames so their order among the app frames is kept.
  const groups = React.useMemo(() => {
    const out: { app: boolean; frames: Frame[] }[] = [];
    for (const f of frames) {
      const app = !!f.app;
      const last = out[out.length - 1];
      if (last && last.app === app) last.frames.push(f);
      else out.push({ app, frames: [f] });
    }
    return out;
  }, [frames]);
  const hidden = frames.filter((f) => !f.app).length;

  const row = (f: Frame, i: number, dim?: boolean) => (
    <li key={i} className={cn("px-3 py-1 font-mono text-xs", dim && "text-muted-foreground")}>
      <span className={cn(!dim && "font-semibold")}>{f.fn ?? "(anonymous)"}</span>
      <span className="text-muted-foreground">
        {" — "}{f.file}{f.line != null ? `:${f.line}` : ""}{f.column != null ? `:${f.column}` : ""}
      </span>
    </li>
  );

  return (
    <div className={cn("overflow-hidden rounded-md border border-border", className)}>
      {error || message ? (
        <div className="border-b border-border bg-muted px-3 py-2">
          {error ? <p className="font-mono text-xs font-semibold">{error}</p> : null}
          {message ? <p className="mt-0.5 font-mono text-xs">{message}</p> : null}
        </div>
      ) : null}
      <ol className="divide-y divide-border">
        {groups.map((g, gi) =>
          g.app || showAll
            ? g.frames.map((f, i) => row(f, gi * 1000 + i, !g.app))
            : (
              <li key={gi} className="px-3 py-1">
                <button type="button" onClick={() => setShowAll(true)}
                  className="cursor-pointer font-mono text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
                  {g.frames.length} {g.frames.length === 1 ? "frame" : "frames"} from libraries
                </button>
              </li>
            ))}
      </ol>
      {hidden > 0 ? (
        <div className="border-t border-border px-3 py-1.5">
          <button type="button" onClick={() => setShowAll((v) => !v)}
            className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
            {showAll ? `Hide the ${hidden} library frames` : `Show all ${frames.length} frames`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
