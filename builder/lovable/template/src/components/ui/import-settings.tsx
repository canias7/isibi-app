import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Import settings — validate, preview, then apply. Never silently.
 *
 * NOTHING IS APPLIED ON PASTE. The file is parsed, checked against the keys
 * this app actually has, and the CHANGES are listed with a count before an
 * explicit Apply — an import that applies on selection turns "let me look
 * at this file" into "I have replaced my configuration".
 *
 * A WRONG FILE SAYS WHAT IT GOT versus what was expected ("this looks like
 * a bookings export, not settings") — "invalid file" sends people into a
 * guessing loop with the one person who cannot see the file: support.
 *
 * UNKNOWN KEYS ARE REPORTED AND SKIPPED, not applied and not fatal — a file
 * from a newer version carries settings this version has not got, and
 * refusing the whole file over them strands downgraders.
 *
 * `known` is the allow-list of applyable keys; values are applied only for
 * those. The parse result never touches state until Apply.
 */
export function ImportSettings({ known, current, onApply, className }: {
  known: string[];
  current: Record<string, unknown>;
  onApply: (values: Record<string, unknown>) => void;
  className?: string;
}) {
  const [text, setText] = React.useState("");
  const [report, setReport] = React.useState<null | { error?: string; changes?: [string, unknown][]; unknown?: string[]; same?: number }>(null);

  const inspect = () => {
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch {
      setReport({ error: "That is not JSON — expected a settings file exported from here." });
      return;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      setReport({ error: Array.isArray(parsed)
        ? "That is a list — it looks like a data export, not settings."
        : "Expected an object of settings, got a " + typeof parsed + "." });
      return;
    }
    const entries = Object.entries(parsed as Record<string, unknown>);
    const unknownKeys = entries.filter(([k]) => !known.includes(k)).map(([k]) => k);
    const knownEntries = entries.filter(([k]) => known.includes(k));
    const changes = knownEntries.filter(([k, v]) => JSON.stringify(current[k]) !== JSON.stringify(v));
    setReport({ changes: changes as [string, unknown][], unknown: unknownKeys, same: knownEntries.length - changes.length });
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <textarea value={text} onChange={(e) => { setText(e.target.value); setReport(null); }}
        rows={3} placeholder="Paste a settings file"
        className="w-full resize-y rounded-md border border-input bg-background px-2.5 py-1.5 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      {!report ? (
        <button type="button" onClick={inspect} disabled={!text.trim()}
          className="cursor-pointer self-start rounded-md border border-border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40">
          Check the file
        </button>
      ) : report.error ? (
        <p className="text-sm text-muted-foreground">{report.error}</p>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          {report.changes!.length ? (
            <>
              <p className="text-sm font-medium">{report.changes!.length} setting{report.changes!.length === 1 ? "" : "s"} would change:</p>
              <ul className="text-xs text-muted-foreground">
                {report.changes!.map(([k, v]) => (
                  <li key={k} className="tabular-nums">{k}: {JSON.stringify(current[k])} → {JSON.stringify(v)}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing would change — the file matches what you have.</p>
          )}
          {report.unknown!.length ? (
            <p className="text-xs text-muted-foreground">
              Skipped (not settings this version has): {report.unknown!.join(", ")}
            </p>
          ) : null}
          {report.changes!.length ? (
            <button type="button"
              onClick={() => onApply(Object.fromEntries(report.changes!))}
              className="cursor-pointer self-start rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
              Apply {report.changes!.length === 1 ? "the change" : `these ${report.changes!.length}`}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
