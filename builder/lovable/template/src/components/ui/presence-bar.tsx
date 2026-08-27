import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The row of avatars showing who else is here.
 *
 * IT OVERFLOWS INTO A COUNT rather than growing. Twelve avatars in a toolbar
 * push out the buttons beside them, and past about four nobody reads faces
 * anyway — "+8" plus a list on press is the whole information.
 *
 * A NAME IS ALWAYS AVAILABLE, in a title and in the accessible name. A row of
 * unlabelled circles conveys nothing to a screen reader and very little to
 * anybody who has not memorised their colleagues' photographs.
 *
 * IDLE IS SHOWN, and it matters more than presence: somebody with the document
 * open in a background tab is not watching, and treating them as present is how
 * a message goes unanswered for an hour. Dimmed plus a stated status, never
 * colour alone.
 *
 * YOU are excluded by default. Your own avatar in the presence bar is a row
 * position spent on the one person who does not need telling they are here.
 */
export function PresenceBar({ people, me, max = 4, onShowAll, className }: {
  people: { id: string; name: string; initials?: string; idle?: boolean; colour?: string }[];
  me?: string;
  max?: number;
  onShowAll?: () => void;
  className?: string;
}) {
  const others = people.filter((p) => p.id !== me);
  const shown = others.slice(0, max);
  const extra = others.length - shown.length;

  if (others.length === 0) {
    return <p data-slot="presence-bar" className={cn("text-xs text-muted-foreground", className)}>Only you are here.</p>;
  }
  return (
    <div className={cn("flex items-center", className)}>
      <ul className="flex -space-x-2">
        {shown.map((p) => (
          <li key={p.id}>
            <span
              title={`${p.name}${p.idle ? " — idle" : ""}`}
              className={cn("grid size-7 place-items-center rounded-full border-2 border-background bg-muted text-[10px] font-medium",
                p.idle && "opacity-50")}>
              <span aria-hidden>{p.initials ?? p.name.slice(0, 2).toUpperCase()}</span>
              <span className="sr-only">{p.name}{p.idle ? ", idle" : ", here now"}</span>
            </span>
          </li>
        ))}
      </ul>
      {extra > 0 ? (
        <button type="button" onClick={onShowAll}
          aria-label={`${extra} more ${extra === 1 ? "person" : "people"} here`}
          className="ms-1 cursor-pointer rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium tabular-nums hover:bg-muted">
          +{extra}
        </button>
      ) : null}
      <span aria-live="polite" className="sr-only">
        {others.length} {others.length === 1 ? "person" : "people"} here
      </span>
    </div>
  );
}
