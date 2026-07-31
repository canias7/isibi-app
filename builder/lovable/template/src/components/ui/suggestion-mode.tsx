import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
/**
 * A proposed edit shown inline, with accept and reject.
 *
 * The removed text is struck through AND tinted, the added text underlined
 * AND tinted — never colour alone, which is the single commonest failure in
 * every track-changes UI ever built and makes them unusable in greyscale or
 * to anyone red-green colourblind.
 *
 * Whoever proposed it is named. An anonymous suggestion is one nobody knows
 * whether to trust.
 */
export function SuggestionMode({ before, after, by, onAccept, onReject, className }: {
  before?: string; after?: string; by?: string;
  onAccept?: () => void; onReject?: () => void; className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-1", className)}>
      {before && <del className="bg-destructive/10 text-destructive no-underline line-through">{before}</del>}
      {after && <ins className="bg-success/10 text-success underline decoration-dotted">{after}</ins>}
      <span className="inline-flex items-center gap-0.5 align-middle">
        {by && <span className="mr-1 text-[10px] text-muted-foreground">{by}</span>}
        {onAccept && (
          <Button type="button" size="icon-sm" variant="ghost" onClick={onAccept} aria-label="Accept suggestion">
            <Check className="size-3.5" />
          </Button>
        )}
        {onReject && (
          <Button type="button" size="icon-sm" variant="ghost" onClick={onReject} aria-label="Reject suggestion">
            <X className="size-3.5" />
          </Button>
        )}
      </span>
    </span>
  );
}
