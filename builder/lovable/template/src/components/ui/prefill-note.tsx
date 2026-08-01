import { cn } from "@/lib/utils";
/**
 * "We filled this in from your last booking."
 *
 * PREFILLED DATA THAT DOES NOT SAY SO IS TRUSTED WITHOUT BEING CHECKED. An
 * address carried over from six months ago looks exactly like one just typed,
 * and the parcel goes to the old flat.
 *
 * IT NAMES THE SOURCE AND OFFERS TO UNDO. "From your last booking · use
 * something else" makes the value editable in the reader's mind, which a silent
 * prefill does not.
 *
 * `role="status"` so it is announced with the field rather than read as loose
 * text — the whole point is that it attaches to the value.
 */
export function PrefillNote({ source, onClear, className }: {
  /** Where the value came from — "your last booking". */
  source: string;
  onClear?: () => void;
  className?: string;
}) {
  return (
    <p role="status" className={cn("flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground", className)}>
      <span>Filled in from {source}</span>
      {onClear && (
        <button type="button" onClick={onClear} className="cursor-pointer underline underline-offset-2">
          Use something else
        </button>
      )}
    </p>
  );
}
