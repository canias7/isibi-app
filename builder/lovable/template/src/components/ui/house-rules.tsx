import { cn } from "@/lib/utils";
/**
 * When you can arrive, when you must leave, and what the rules are in between.
 *
 * THE ARRIVAL WINDOW IS NOT A RULE, IT IS A GATE. A campsite whose barrier
 * locks at 22:00 and a guest who set off at seven are the commonest disaster in
 * this trade — and it is always in a PDF called "terms", linked from a footer,
 * behind a cookie banner. So arrival and departure are lifted OUT of the list
 * and printed as times at weight, with the what-if-I-am-late sentence beside
 * them rather than left to be guessed.
 *
 * FIRM AND FLEXIBLE ARE MARKED DIFFERENTLY, because they are argued about
 * differently. "The barrier is locked" ends a conversation; "we ask that" opens
 * one — and a business that prints every preference as an absolute gets treated
 * as though none of them are. Same discipline as `entry-requirements` splitting
 * a licence condition from a house rule.
 *
 * NOTHING IS TICKABLE AND NOTHING IS COLOURED. This is not a checklist and
 * there is no state to be in; every line applies to everybody. Empty boxes
 * imply somewhere they get filled in, which is a promise the page cannot keep.
 *
 * A RULE WITH NO TIME IS STILL A RULE. `at` is optional precisely because
 * "dogs on a lead everywhere" has no clock — but where a time exists it is the
 * half people are caught by, so it is printed on its own and not buried mid
 * sentence.
 */
export type Rule = {
  what: string;
  /** "22:00", "after 23:00", "10:00–16:00". Where a rule has a clock, it leads. */
  at?: string | null;
  /** True where it is enforced rather than requested. Firm and asked-for are different. */
  firm?: boolean;
  detail?: string | null;
};
export function HouseRules({
  rules, arrive, leave, lateNote, heading = "While you are here", className,
}: {
  rules: Rule[];
  /** "From 13:00 until 20:00". The window, not a single time. */
  arrive?: string | null;
  leave?: string | null;
  /** What to do about arriving outside the window. The sentence that prevents the disaster. */
  lateNote?: string | null;
  heading?: string;
  className?: string;
}) {
  const hasTimes = !!(arrive || leave);
  if (!hasTimes && !rules.length) return null;
  return (
    <div className={cn("", className)}>
      {hasTimes && (
        /* OUT OF THE LIST ON PURPOSE. Sixteenth in a list of rules is where
           this lives on every other site, and it is the one that strands
           somebody on a lane at half ten at night. */
        <div className="rounded-lg border border-border bg-muted/50 p-5">
          <dl className="flex flex-wrap gap-x-10 gap-y-4">
            {arrive && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Arrive</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">{arrive}</dd>
              </div>
            )}
            {leave && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Leave by</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">{leave}</dd>
              </div>
            )}
          </dl>
          {lateNote && <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{lateNote}</p>}
        </div>
      )}
      {rules.length > 0 && (
        <>
          <h2 className={cn("text-xs font-medium uppercase tracking-widest text-muted-foreground", hasTimes && "mt-8")}>{heading}</h2>
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {rules.map((r) => (
              <li key={r.what} className="grid gap-x-6 gap-y-1 py-3.5 sm:grid-cols-[1fr_auto]">
                <div>
                  <p className={cn("text-base", r.firm ? "font-medium" : "")}>{r.what}</p>
                  {r.detail && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{r.detail}</p>}
                </div>
                <div className="sm:text-right">
                  {r.at && <p className="text-base font-medium tabular-nums">{r.at}</p>}
                  {/* THE WORD, not a colour. A preference printed as an
                      absolute gets every rule treated as a preference. */}
                  <p className={cn("text-sm", r.at && "mt-0.5", r.firm ? "font-medium" : "text-muted-foreground")}>
                    {r.firm ? "Enforced" : "We ask"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
