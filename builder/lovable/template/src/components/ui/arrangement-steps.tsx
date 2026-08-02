import { cn } from "@/lib/utils";
/**
 * What happens next, said plainly. For the week after somebody dies.
 *
 * THIS IS NOT A STEPPER AND MUST NOT LOOK LIKE ONE. `Steps` and the progress
 * components in this kit render a task the reader is completing — ticks,
 * connecting rules, a sense of getting somewhere. Nobody arranging a funeral is
 * completing a task, and dressing it as one is the exact tone this replaces.
 * So: numbers set small and quiet, no ticks, no line between them, no state.
 *
 * `youDo` IS ALLOWED TO SAY NOTHING, and on most steps it should. The single
 * most useful sentence a funeral director's website can print is "there is
 * nothing you need to do for this one" — an empty column here renders as
 * exactly that rather than being dropped, because a gap reads as an omission
 * and leaves somebody wondering what they have missed.
 *
 * NO EUPHEMISM IS APPLIED BY THE COMPONENT. It prints the words it is given.
 * That is a real decision: a component that turned "died" into "passed" would
 * be making a choice on behalf of a family, and different families want
 * different words. The copy is theirs.
 *
 * `when` IS PLAIN LANGUAGE — "the same day", "within a week", "whenever you are
 * ready" — never a date and never a countdown. A deadline printed next to a
 * bereaved person is pressure they did not ask for, and most of these have no
 * real deadline at all.
 */
export type Arrangement = {
  title: string;
  /** What happens, in sentences. */
  what: string;
  /** What the family does. Leave empty for "nothing you need to do". */
  youDo?: string | null;
  /** "The same day", "within a week". Never a date. */
  when?: string | null;
};
export function ArrangementSteps({ steps, nothingLabel = "Nothing you need to do", className }: {
  steps: Arrangement[];
  /** The wording when a step asks nothing of the family. */
  nothingLabel?: string;
  className?: string;
}) {
  if (!steps.length) return null;
  return (
    <ol className={cn("space-y-0", className)}>
      {steps.map((s, i) => (
        <li key={s.title} className="border-t border-border py-7 last:border-b">
          <div className="grid gap-x-10 gap-y-4 md:grid-cols-[auto_1fr_1fr]">
            <p className="text-sm tabular-nums text-muted-foreground md:w-8">{i + 1}</p>
            <div>
              <h3 className="text-lg font-medium tracking-tight">{s.title}</h3>
              {s.when && <p className="mt-1 text-sm text-muted-foreground">{s.when}</p>}
              <p className="mt-2 text-base leading-relaxed">{s.what}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">You</p>
              <p className={cn("mt-2 text-base leading-relaxed", !s.youDo && "text-muted-foreground")}>
                {s.youDo || nothingLabel}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
