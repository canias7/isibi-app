import { cn } from "@/lib/utils";
/**
 * "A machine wrote this."
 *
 * THE MOST IMPORTANT COMPONENT IN THIS GROUP, and the one most often left out.
 * Generated text is indistinguishable from written text, and a reader who
 * assumes a person checked it will act on it differently. Saying so is not a
 * disclaimer — it is the fact that determines how much weight to give the rest.
 *
 * IT DISTINGUISHES REVIEWED FROM UNREVIEWED. "Drafted by AI, checked by Sam" and
 * "generated, not checked" are completely different claims, and collapsing them
 * into one badge is what makes disclosure meaningless.
 *
 * Plain words, no sparkle icon. A decorative glyph is the convention that turned
 * disclosure into branding, and it says nothing to a screen reader.
 */
export function AiDisclosure({ reviewedBy, what = "This", model, className }: {
  /** Who checked it. Omitted means nobody did. */
  reviewedBy?: string;
  what?: string;
  /** Named where it matters — not for branding. */
  model?: string;
  className?: string;
}) {
  return (
    <p data-slot="ai-disclosure" className={cn("text-xs text-muted-foreground", className)}>
      <span className="font-medium text-foreground">
        {what} was written by AI{reviewedBy ? ` and checked by ${reviewedBy}` : " and has not been checked"}
      </span>
      {model ? ` · ${model}` : ""}
    </p>
  );
}
