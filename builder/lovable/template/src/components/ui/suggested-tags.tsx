import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Tags proposed for this thing, each one tap to accept.
 *
 * THEY ARE OFFERS, NOT APPLIED. Auto-tagging that writes straight to the record
 * puts a guess into the same field as a human decision, and nothing afterwards
 * can tell them apart — which matters the moment somebody filters on it and
 * gets results nobody chose.
 *
 * DISMISS IS PERMANENT AND SEPARATE FROM IGNORING. Without it the same wrong
 * suggestion returns on every load and people stop reading the row entirely,
 * which is how a useful suggestion gets missed among four bad ones.
 *
 * ALREADY-APPLIED TAGS ARE FILTERED OUT HERE rather than shown ticked. This row
 * is a to-do list; a suggestion already taken is done, and leaving it makes the
 * count of outstanding offers meaningless.
 *
 * NO CONFIDENCE PERCENTAGES. A number invites arguing with the model instead of
 * with the tag, and the only real question is whether the word fits.
 */
export function SuggestedTags({ suggestions, applied = [], onAccept, onDismiss, label = "Suggested", className }: {
  suggestions: { id: string; label: string }[];
  /** Ids already on the record — filtered out. */
  applied?: string[];
  onAccept: (id: string) => void;
  onDismiss?: (id: string) => void;
  label?: string;
  className?: string;
}) {
  const open = suggestions.filter((s) => !applied.includes(s.id));
  if (!open.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {open.map((s) => (
        <span key={s.id} className="inline-flex items-center rounded-full border border-dashed border-border">
          <button type="button" onClick={() => onAccept(s.id)}
            className="inline-flex items-center gap-1 py-0.5 ps-2 pe-1.5 text-xs">
            <Plus className="size-3" aria-hidden="true" />
            {s.label}
          </button>
          {onDismiss && (
            <button type="button" onClick={() => onDismiss(s.id)} aria-label={`Never suggest ${s.label}`}
              className="border-s border-border px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground">
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
