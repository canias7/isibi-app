import { cn } from "@/lib/utils";
/**
 * "We split that into three fields."
 *
 * PASTING A WHOLE ADDRESS INTO THE FIRST LINE IS WHAT PEOPLE DO, and the usual
 * result is one field containing everything and a form that fails validation for
 * reasons nobody can see. Splitting it is right; doing it SILENTLY is not.
 *
 * IT SHOWS WHAT WENT WHERE and offers to undo. An automatic split that guesses
 * wrongly and says nothing is worse than no split at all, because the reader has
 * no reason to re-check fields they never filled in.
 *
 * `role="status"` — it follows a paste the reader just made, and they are
 * looking at the field rather than below it.
 */
export function PasteParse({ fields, onUndo, className }: {
  /** What was extracted — [{ label: "Postcode", value: "TR11 3QY" }]. */
  fields: { label: string; value: string }[];
  onUndo?: () => void;
  className?: string;
}) {
  if (!fields.length) return null;
  return (
    <div role="status" className={cn("flex flex-col gap-1 rounded-md border border-border p-2 text-xs", className)}>
      <p className="font-medium">We split that into {fields.length} fields</p>
      <ul className="text-muted-foreground">
        {fields.map((f) => <li key={f.label}>{f.label}: {f.value}</li>)}
      </ul>
      {onUndo && (
        <button type="button" onClick={onUndo} className="w-fit cursor-pointer underline underline-offset-2">
          Undo and paste as one line
        </button>
      )}
    </div>
  );
}
