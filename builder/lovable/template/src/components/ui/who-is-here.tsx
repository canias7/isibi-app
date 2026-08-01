import { cn } from "@/lib/utils";
/**
 * The people on this page right now, as a stack of initials.
 *
 * THE OVERFLOW COUNT IS A REAL NUMBER, not "+more". Whether two other people
 * or forty are watching a document changes what somebody does next, and a
 * stack that silently caps at five reports both as the same thing.
 *
 * NAMES ARE REACHABLE WITHOUT HOVER, via the `<ul>` this renders and the
 * `title` on each avatar. Presence stacks are usually a row of divs whose names
 * exist only in a tooltip, which means a screen reader user is told there are
 * five circles.
 *
 * IDLE PEOPLE ARE DIMMED AND SAID SO in their label — "away" is different from
 * "here" and it is the difference between waiting for a reply and not.
 *
 * INITIALS, NOT PHOTOGRAPHS. This is a presence indicator on a live page: an
 * avatar image per person is a request per person, on every page load, for
 * information two letters convey.
 */
export type Present = { id: string; name: string; idle?: boolean };

export function WhoIsHere({ people, max = 5, label = "Here now", className }: {
  people: Present[];
  max?: number;
  label?: string;
  className?: string;
}) {
  if (!people.length) return null;
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="sr-only">{label}: {people.map((p) => p.name).join(", ")}</span>
      <ul aria-hidden="true" className="flex -space-x-1.5">
        {shown.map((p) => (
          <li key={p.id} title={`${p.name}${p.idle ? " (away)" : ""}`}
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-full border border-background bg-muted text-[10px] font-medium uppercase",
              p.idle && "opacity-50",
            )}>
            {p.name.trim().slice(0, 2)}
          </li>
        ))}
        {rest > 0 && (
          <li className="inline-flex size-6 items-center justify-center rounded-full border border-background bg-foreground text-[10px] font-medium tabular-nums text-background">
            +{rest}
          </li>
        )}
      </ul>
    </div>
  );
}
