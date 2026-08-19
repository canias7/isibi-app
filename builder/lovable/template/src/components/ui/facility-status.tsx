import { cn } from "@/lib/utils";
/**
 * What is free RIGHT NOW, per activity, and when the next one is.
 *
 * A LEISURE CENTRE'S VISITOR IS ASKING "CAN I GET ON TODAY", and every one of
 * these sites answers "we exist". The pool, the courts and the lanes each have
 * their own answer at any given hour — the pool is shut for lessons until four,
 * two courts are free now, the range is full until six — and a single opening
 * hours table says none of it.
 *
 * FREE, BUSY AND CLOSED ARE THREE STATES, NOT TWO. A pool closed for a club
 * session and a pool with every lane taken are different problems with
 * different answers: one you cannot use at all, the other you can wait for.
 * Collapsing them into "unavailable" sends somebody down there to find out.
 *
 * MARKED BY WEIGHT AND A WORD, never a colour. Three coloured dots are one dot
 * in greyscale, on a phone in daylight, and on the screen bolted to the wall in
 * reception — which is where a page like this actually gets read.
 *
 * `nextFree` IS THE FIELD THAT MATTERS when something is not free, and it is
 * why "busy" is worth saying at all. "Full" is a dead end; "Full — next free at
 * 4:30" is a plan. A caller with no forecast omits it rather than inventing
 * one, and the row then says "ring and ask", which is honest.
 *
 * `updated` IS REQUIRED. A live board with no timestamp is a board somebody
 * cannot tell is stale, and stale-but-confident is worse than absent — the same
 * reasoning that makes `when` required on `inspection-rating`.
 */
export type Activity = {
  name: string;
  state: "free" | "busy" | "closed";
  /** "3 of 6 lanes", "2 courts". What is actually free, when something is. */
  detail?: string | null;
  /** Already formatted: "4:30", "tomorrow at 9". The point of saying "busy". */
  nextFree?: string | null;
  /** Why it is closed: "club night", "lessons until 4", "maintenance". */
  reason?: string | null;
};
export function FacilityStatus({ activities, updated, heading = "Right now", className }: {
  activities: Activity[];
  /** REQUIRED. "Updated 14:05" — a live board nobody can date is worse than none. */
  updated: string;
  heading?: string;
  className?: string;
}) {
  if (!activities.length) return null;
  return (
    <div className={cn("", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{heading}</h2>
        <p className="text-xs tabular-nums text-muted-foreground">{updated}</p>
      </div>
      <ul className="mt-3 divide-y divide-border border-y border-border">
        {activities.map((a) => (
          <li key={a.name} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3.5">
            <span className="min-w-0 flex-1">
              <span className={cn("text-base", a.state === "closed" ? "text-muted-foreground" : "font-medium")}>
                {a.name}
              </span>
              {(a.reason || a.detail) && (
                <span className="block text-sm text-muted-foreground">
                  {a.state === "closed" ? a.reason : a.detail}
                </span>
              )}
            </span>
            <span className="shrink-0 text-end">
              {/* THE WORD carries it. Three dots would be one dot on the screen
                  in reception, which is where this is really read. */}
              <span className={cn("block text-sm", a.state === "free" ? "font-semibold" : a.state === "busy" ? "font-medium" : "text-muted-foreground")}>
                {a.state === "free" ? "Free now" : a.state === "busy" ? "Full" : "Closed"}
              </span>
              {a.state !== "free" && (
                <span className="block text-sm text-muted-foreground">
                  {a.nextFree ? `Next free ${a.nextFree}` : "Ring and ask"}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
