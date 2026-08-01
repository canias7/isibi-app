import { cn } from "@/lib/utils";
/**
 * A claim someone has checked, with who checked it.
 *
 * A TICK WITH NO PROVENANCE IS DECORATION. "Verified" means nothing without
 * saying who verified it and when — and an unqualified badge is exactly what
 * makes people distrust every badge, including the meaningful ones.
 *
 * NO BLUE TICK, no icon at all. The words carry it, which also means the claim
 * survives greyscale and reads correctly to a screen reader rather than
 * announcing a decorative glyph.
 *
 * AN EXPIRED CHECK SAYS SO rather than quietly continuing to display. A
 * certification verified three years ago and never rechecked is a different
 * claim from one checked last week, and silence favours the seller.
 */
export function VerifiedClaim({ claim, by, at, expired, howHref, className }: {
  claim: string;
  /** Who checked it. Required for the claim to mean anything. */
  by: string;
  /** When, as a display string. */
  at?: string;
  expired?: boolean;
  /** Link explaining the check. */
  howHref?: string;
  className?: string;
}) {
  return (
    <p className={cn("text-xs", className)}>
      <span className={cn(expired ? "text-muted-foreground line-through" : "font-medium")}>{claim}</span>
      <span className="text-muted-foreground">
        {" — "}{expired ? "was checked" : "checked"} by {by}{at ? `, ${at}` : ""}
        {expired ? " and needs rechecking" : ""}
      </span>
      {howHref && (
        <> <a href={howHref} className="underline underline-offset-2">How this is checked</a></>
      )}
    </p>
  );
}
