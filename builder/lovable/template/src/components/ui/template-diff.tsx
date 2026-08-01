import { cn } from "@/lib/utils";
/**
 * How this one has drifted from the template it came from.
 *
 * DRIFT IS INVISIBLE OTHERWISE. A thing made from a template and edited for six
 * months looks identical to one made yesterday, so "why is this one different?"
 * has no answer anywhere in the interface — and the template gets updated while
 * everything made from it silently keeps the old shape.
 *
 * BOTH DIRECTIONS ARE SHOWN. Fields this one changed, AND fields the template
 * gained since — the second is the half every implementation forgets, and it is
 * the one that answers "am I missing something everyone else has?".
 *
 * ADDED, REMOVED AND CHANGED ARE MARKED WITH SYMBOLS AND WORDS, never red and
 * green. A diff is the single most colour-dependent UI convention there is, and
 * it is also the one most likely to be read in a printout.
 *
 * THE ORDER IS CHANGED, THEN MISSING, THEN EXTRA, because that is the order of
 * how much each is likely to matter to the person asking.
 */
export type DiffRow = { key: string; label: string; kind: "changed" | "missing" | "extra"; here?: string; template?: string };

const MARK: Record<DiffRow["kind"], { sign: string; word: string }> = {
  changed: { sign: "±", word: "Changed here" },
  missing: { sign: "−", word: "In the template, not here" },
  extra: { sign: "+", word: "Here only" },
};
const ORDER: DiffRow["kind"][] = ["changed", "missing", "extra"];

export function TemplateDiff({ templateName, rows, sameNote = "Identical to the template", className }: {
  templateName: string;
  rows: DiffRow[];
  sameNote?: string;
  className?: string;
}) {
  if (!rows.length) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{sameNote}</p>;
  }
  const sorted = [...rows].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm">
        <span className="font-medium tabular-nums">{rows.length}</span> differences from{" "}
        <span className="font-medium">{templateName}</span>
      </p>
      <ul className="divide-y divide-border rounded-md border border-border">
        {sorted.map((r) => (
          <li key={r.key} className="flex gap-3 px-3 py-2 text-sm">
            <span aria-hidden="true" className="w-3 shrink-0 text-center text-muted-foreground">{MARK[r.kind].sign}</span>
            <span className="min-w-0 flex-1">
              <span className="block">{r.label}</span>
              <span className="block text-xs text-muted-foreground">{MARK[r.kind].word}</span>
              {r.kind === "changed" && (
                <span className="mt-0.5 block text-xs">
                  <span className="text-muted-foreground">Template: </span>{r.template}
                  <span className="text-muted-foreground"> · Here: </span>{r.here}
                </span>
              )}
              {r.kind === "missing" && r.template && (
                <span className="mt-0.5 block text-xs"><span className="text-muted-foreground">Template: </span>{r.template}</span>
              )}
              {r.kind === "extra" && r.here && (
                <span className="mt-0.5 block text-xs"><span className="text-muted-foreground">Here: </span>{r.here}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
