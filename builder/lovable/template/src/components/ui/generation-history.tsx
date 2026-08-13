import { cn, isoAttr, toDate } from "@/lib/utils";
/**
 * The earlier attempts, so a better one is not lost by regenerating past it.
 *
 * THE FAILURE THIS EXISTS FOR: somebody presses regenerate, gets something
 * worse, and the good version is gone. Every generate-again surface needs this
 * and almost none have it — which is why "regenerate" feels like a gamble
 * rather than a tool.
 *
 * NEWEST FIRST, and the current one is marked with a WORD ("Showing") plus a
 * heavier weight, never a colour. Position alone does not say which is live
 * after somebody has restored an older one.
 *
 * EACH ENTRY IS A BUTTON, so the whole row is the target — a small "restore"
 * link at the end of a row is a needle to hit on a phone.
 *
 * The prompt is clamped to two lines rather than truncated to a character
 * count, so a long prompt still shows its opening sentence intact instead of
 * being cut mid-word.
 */
export type Generation = { id: string; prompt?: string; at?: string; note?: string };

export function GenerationHistory({ items, currentId, onRestore, emptyNote = "No earlier versions", className }: {
  /** Newest first. */
  items: Generation[];
  currentId?: string;
  onRestore: (id: string) => void;
  emptyNote?: string;
  className?: string;
}) {
  if (!items.length) return <p className={cn("text-sm text-muted-foreground", className)}>{emptyNote}</p>;
  return (
    <ul className={cn("divide-y divide-border rounded-md border border-border", className)}>
      {items.map((g) => {
        const live = g.id === currentId;
        const d = g.at ? toDate(g.at) : null;
        const ok = d && !Number.isNaN(d.getTime());
        return (
          <li key={g.id}>
            <button type="button" disabled={live} onClick={() => onRestore(g.id)}
              className={cn("flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm",
                live ? "cursor-default bg-muted/40" : "hover:bg-muted/40")}>
              <span className="flex w-full items-baseline gap-2">
                <span className={cn("min-w-0 line-clamp-2", live && "font-medium")}>
                  {g.prompt || "Untitled version"}
                </span>
                {live && <span className="ml-auto shrink-0 text-xs font-medium">Showing</span>}
              </span>
              <span className="text-xs text-muted-foreground">
                {ok ? (
                  <time dateTime={isoAttr(d)}>
                    {d!.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </time>
                ) : g.at}
                {g.note && <span>{g.at ? " · " : ""}{g.note}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
