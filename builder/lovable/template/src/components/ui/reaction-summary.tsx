import { cn } from "@/lib/utils";
/**
 * The reactions on something, with yours marked and the names available.
 *
 * WHO REACTED IS THE INTERESTING PART. A count says three people agreed;
 * knowing WHICH three is what makes a reaction useful instead of decorative —
 * "the two people who have to approve it liked this" is a different fact from
 * "3 👍". The names ride in `title` and in the accessible label.
 *
 * YOUR OWN REACTION IS MARKED BY BORDER AND BY WORDING, never by colour alone,
 * and `aria-pressed` carries it properly. Otherwise there is no way to tell
 * whether you already reacted, so people click twice and remove their own.
 *
 * IT DOES NOT OFFER AN EMOJI PICKER. A fixed short set is what makes reactions
 * scannable; open-ended picking produces forty distinct single-use emoji and a
 * summary nobody can read at a glance.
 *
 * THE EMOJI IS `aria-hidden` and the count carries the meaning — "thumbs up
 * sign, 3" is noise where "Liked by Sam, Ada and Kit" is the fact.
 */
export type Reaction = { emoji: string; label: string; by: string[]; mine?: boolean };

export function ReactionSummary({ reactions, onToggle, className }: {
  reactions: Reaction[];
  onToggle?: (emoji: string) => void;
  className?: string;
}) {
  const shown = reactions.filter((r) => r.by.length > 0);
  if (!shown.length) return null;
  return (
    <div data-slot="reaction-summary" className={cn("flex flex-wrap gap-1", className)}>
      {shown.map((r) => {
        const names = r.by.length <= 3
          ? r.by.join(", ")
          : `${r.by.slice(0, 3).join(", ")} and ${r.by.length - 3} more`;
        const inner = (
          <>
            <span aria-hidden="true">{r.emoji}</span>
            <span className="tabular-nums">{r.by.length}</span>
            <span className="sr-only">{r.label} — {names}{r.mine ? ", including you" : ""}</span>
          </>
        );
        return onToggle ? (
          <button key={r.emoji} type="button" title={names} aria-pressed={Boolean(r.mine)}
            onClick={() => onToggle(r.emoji)}
            className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
              r.mine ? "border-foreground bg-muted" : "border-border")}>
            {inner}
          </button>
        ) : (
          <span key={r.emoji} title={names}
            className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
              r.mine ? "border-foreground bg-muted" : "border-border")}>
            {inner}
          </span>
        );
      })}
    </div>
  );
}
