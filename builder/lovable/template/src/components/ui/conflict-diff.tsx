import { cn } from "@/lib/utils";
/**
 * Two versions of the same field, side by side, when a save collided.
 *
 * Labelled "Yours" and "Theirs" rather than left and right, because on a phone
 * they stack and left/right stops being true. `by` names the other person when
 * the caller knows it — "Theirs" is a shape, a name is an explanation.
 *
 * NEITHER SIDE IS STYLED AS THE WINNER. A version-conflict component that
 * visually favours one is making the choice on the reader's behalf, and it is
 * the reader who knows which edit mattered. `conflict-choice` is the half that
 * decides; this one only shows.
 *
 * Values render as plain text with `whitespace-pre-wrap`, so a multi-line note
 * keeps its shape instead of collapsing into a paragraph — which is exactly the
 * difference somebody is trying to see.
 */
export function ConflictDiff({ field, mine, theirs, base, by, className }: {
  /** The field that collided. */
  field: string;
  mine: string;
  theirs: string;
  /** What both edits started from, when it is known. */
  base?: string;
  /** Who made the other edit. */
  by?: string;
  className?: string;
}) {
  return (
    <div data-slot="conflict-diff" className={cn("rounded-md border border-border", className)}>
      <p className="border-b border-border px-3 py-2 text-sm font-medium">{field}</p>
      <dl className="grid gap-px bg-border sm:grid-cols-2">
        <div className="bg-background p-3">
          <dt className="text-xs font-medium text-muted-foreground">Yours</dt>
          <dd className="mt-1 text-sm whitespace-pre-wrap">{mine}</dd>
        </div>
        <div className="bg-background p-3">
          <dt className="text-xs font-medium text-muted-foreground">
            {by ? `${by}'s` : "Theirs"}
          </dt>
          <dd className="mt-1 text-sm whitespace-pre-wrap">{theirs}</dd>
        </div>
        {base !== undefined && (
          <div className="bg-background p-3 sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">Before either edit</dt>
            <dd className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">{base}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
