import { cn } from "@/lib/utils";
/**
 * A list that really IS a queue — and therefore prints the position.
 *
 * THREE COMPONENTS SAY "WAITING" AND THEY ARE NOT INTERCHANGEABLE. Pick by what
 * kind of list it is, not by the word:
 *   · `queue-position` — a LIVE queue, minutes deep. "You're 14th · about 20
 *     minutes." A call queue, a virtual waiting room.
 *   · `waiting-list-note` — a CLINICAL list, and it refuses to show a rank,
 *     correctly: people are added ahead on urgency, so "you are 41st" becomes a
 *     countdown that goes backwards.
 *   · this one — an ORDERED list, months or years deep, where you join the
 *     bottom and only ever move up.
 *
 * ON A REAL QUEUE, HIDING THE POSITION IS THE DISHONEST CHOICE. That is the
 * mirror of the clinical component and the reason both exist. Measured: the
 * clinical one was used on an allotment page and its own footnote — "there is
 * no position number here on purpose, lists are not queues" — contradicted the
 * headline three inches above it.
 *
 * THE WAIT IS DERIVED, NEVER PASSED. Thirty-one ahead and nineteen places freed
 * last year is twenty months, and that is arithmetic rather than an opinion.
 * Every association in the country says "about a year", and most are quoting a
 * figure their own two numbers contradict — the `rate-board` rule, except here
 * the drifting number is the one somebody plans a year around.
 *
 * "THERE IS A WAITING LIST" IS NOT AN ANSWER, and that sentence is what this
 * replaces. Nine months and nine years are the same phrase, and the difference
 * is entirely whether a person bothers to join.
 *
 * NO PROMISED DATE. It says "at last year's rate": honest, checkable, and
 * unreadable as a commitment. A date would be a guess about how many other
 * people give up.
 *
 * WHAT MOVES YOU UP IS A REAL LIST, not a joined sentence. Each line is a
 * decision available today that somebody almost certainly does not know about.
 */
export type QueueMover = {
  /** The decision: "Take a half plot as well as a full one". */
  what: string;
  /** What it does: "Roughly halves the wait". */
  effect?: string;
};
export function WaitingListPlace({
  forWhat, ahead, freedLastYear, total, joinedOn, movers = [], paused, pausedNote, contact, className,
}: {
  forWhat: string;
  /** How many people are in front. The number this component exists to print. */
  ahead: number;
  /** Places that came free in the last year. With `ahead`, this IS the wait. */
  freedLastYear?: number;
  /** The whole list, where it is worth saying. */
  total?: number;
  /** When this person joined, on a page that knows. */
  joinedOn?: string;
  movers?: QueueMover[];
  paused?: boolean;
  pausedNote?: string;
  contact?: string;
  className?: string;
}) {
  // Arithmetic, not an estimate. Rounded to a month, because the inputs are
  // annual and a decimal would imply a precision neither of them has.
  const months =
    freedLastYear && freedLastYear > 0 ? Math.max(1, Math.round((ahead / freedLastYear) * 12)) : null;
  // Past two years, months stop being a unit anybody feels.
  const asYears =
    months != null && months >= 24 ? `${(months / 12).toFixed(months % 12 === 0 ? 0 : 1)} years` : null;
  return (
    <div data-slot="waiting-list-place" className={cn("", className)}>
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{forWhat}</p>
      {/* THE TWO NUMBERS TOGETHER. Either one alone is close to meaningless. */}
      <div className="mt-3 flex flex-wrap items-baseline gap-x-10 gap-y-3 border-y border-border py-4">
        <div>
          <p className="text-3xl font-semibold tabular-nums">{ahead.toLocaleString("en-GB")}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {ahead === 1 ? "person ahead of you" : "people ahead of you"}
            {total ? ` · ${total.toLocaleString("en-GB")} on the list` : ""}
          </p>
        </div>
        {months != null && (
          <div>
            <p className="text-3xl font-semibold tabular-nums">
              {asYears ?? `${months} ${months === 1 ? "month" : "months"}`}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              at last year&rsquo;s rate of {freedLastYear!.toLocaleString("en-GB")}
            </p>
          </div>
        )}
      </div>
      {months == null && (
        <p className="mt-3 max-w-prose text-sm leading-relaxed">
          We do not have a full year of figures to turn that into a time yet, and we would rather
          say so than guess at one.
        </p>
      )}
      {joinedOn && <p className="mt-3 text-sm text-muted-foreground">You joined {joinedOn}.</p>}

      {paused && (
        <p className="mt-4 text-sm font-medium">
          The list is closed to new names at the moment.
          {pausedNote ? <span className="font-normal text-muted-foreground"> {pausedNote}</span> : null}
        </p>
      )}

      {movers.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-medium">What would move you up</p>
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {movers.map((m) => (
              <li key={m.what} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 py-2.5">
                <span className="min-w-0 flex-1 text-sm">{m.what}</span>
                {m.effect && <span className="shrink-0 text-sm text-muted-foreground">{m.effect}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The caveat is about the RATE, not the rank. A place in a queue is a
          fact; how fast the queue moves is last year's, and saying which is
          which is the difference between a figure and a promise. */}
      <p className="mt-4 max-w-prose text-xs leading-relaxed text-muted-foreground">
        The position is exact — this is a queue and nobody is put in front of anybody. The time is
        last year&rsquo;s rate applied to it, so a quiet year makes it longer and a busy one
        shorter.
        {contact ? ` Ask us where you stand at any point: ${contact}.` : ""}
      </p>
    </div>
  );
}
