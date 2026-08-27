import { cn } from "@/lib/utils";
/**
 * "This fits what you have" — or does not.
 *
 * IT NAMES WHAT IT WAS CHECKED AGAINST. "Compatible" is unverifiable and
 * therefore worthless; "fits a 2019 Transit" is a claim the reader can confirm
 * against their own thing, which is the only version worth showing.
 *
 * UNKNOWN IS A THIRD STATE and must not read as yes. Where the check could not
 * be made, saying so is honest and saying "compatible" is how somebody orders
 * the wrong part — the expensive failure this exists to prevent.
 *
 * Words, no ticks or crosses. A green tick and a red cross is precisely the pair
 * that is indistinguishable to the commonest colour blindness, on a control
 * making a yes/no claim.
 */
export function CompatibilityNote({ verdict, against, why, className }: {
  verdict: "fits" | "does-not-fit" | "unknown";
  /** What it was checked against — "a 2019 Transit". */
  against: string;
  /** The detail — "needs the long-wheelbase bracket". */
  why?: string;
  className?: string;
}) {
  const WORD = {
    fits: "Fits",
    "does-not-fit": "Doesn't fit",
    unknown: "Not checked for",
  } as const;
  return (
    <p data-slot="compatibility-note" className={cn("text-xs", className)}>
      <span className={cn(verdict === "fits" ? "text-muted-foreground" : "font-medium")}>
        {WORD[verdict]} {against}
      </span>
      {why && <span className="text-muted-foreground"> — {why}</span>}
    </p>
  );
}
