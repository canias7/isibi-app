import { cn } from "@/lib/utils";
/**
 * "* means required" — said once, before the fields.
 *
 * BEFORE, NOT AFTER. A legend at the bottom of the form explains a convention
 * the reader has already had to guess at, which is no use to anybody.
 *
 * IT HANDLES THE OTHER DIRECTION TOO. On a form where nearly everything is
 * required, marking the exceptions is far less noise — `mode="optional"` says
 * "everything is required unless marked optional", which is the honest way to
 * present that form rather than starring nineteen of twenty fields.
 *
 * The asterisk is `aria-hidden` here and the word carries it, because a screen
 * reader announcing "star" before a sentence about stars is nonsense — the
 * fields themselves should use `required`, which is announced properly.
 */
export function RequiredLegend({ mode = "required", className }: {
  /** "required" stars the few; "optional" marks the exceptions instead. */
  mode?: "required" | "optional";
  className?: string;
}) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {mode === "required"
        ? <><span aria-hidden>*</span> means required</>
        : <>Everything is required unless marked optional</>}
    </p>
  );
}
