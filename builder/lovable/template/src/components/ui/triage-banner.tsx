import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * What to do if it is urgent. Above everything, and it cannot be dismissed.
 *
 * THERE IS NO DISMISS PROP, deliberately, and that is the whole reason this is
 * not `Banner`. A dismissible banner is a banner somebody closes on the day
 * they need it, and the one instruction on a medical site that must never be
 * missed is the one telling somebody where to go when the surgery is shut.
 * Omitting the prop is stronger than defaulting it: nobody can pass one.
 *
 * IT IS AN ESCALATION LADDER, not a single sentence. "Call 999" alone is wrong
 * for the person with an infected finger at 8pm, and "call 111" alone is wrong
 * for the person having a stroke — so each level says WHEN it applies before it
 * says what to do, in that order, because the reader is matching their own
 * situation and not reading a menu of phone numbers.
 *
 * EVERY NUMBER IS A `tel:` LINK. This is read on a phone, by somebody who is
 * frightened, and asking them to memorise six digits and switch apps is a
 * design decision with a cost.
 *
 * `role="alert"` IS NOT USED. It is for something that appears, and this is
 * present at load — several screen readers announce a live region only when it
 * changes, so an alert that was always there can go unread. A labelled region
 * with a real heading is reachable by heading navigation and by landmark
 * navigation, which is how somebody actually finds it.
 */
export type TriageLevel = {
  /** When this applies, in the reader's terms: "Chest pain, or they cannot stay awake". */
  when: string;
  /** What to do: "Call 999 now". */
  action: string;
  /** Digits only, or with spaces — dialled as given. Omit for "go to" instructions. */
  tel?: string | null;
  /** Anything else that matters: "Do not drive them yourself". */
  note?: string | null;
};
export function TriageBanner({ levels, heading = "If it is urgent", className }: {
  /** Most urgent FIRST. The order is the message. */
  levels: TriageLevel[];
  heading?: string;
  className?: string;
}) {
  const id = React.useId();
  if (!levels.length) return null;
  return (
    <section data-slot="triage-banner"
      aria-labelledby={id}
      className={cn("border-y-2 border-foreground bg-muted/60", className)}
    >
      <div className="mx-auto max-w-6xl px-6 py-5">
        <h2 id={id} className="text-xs font-semibold uppercase tracking-widest">{heading}</h2>
        <ul className="mt-3 grid gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {levels.map((l, i) => (
            <li key={l.when} className="flex gap-3">
              {/* WEIGHT AND ORDER carry the urgency, never a red band. A tinted
                  strip is one strip in greyscale and to a good number of the
                  people reading it, and this is the block that may not fail. */}
              <span aria-hidden="true" className="mt-0.5 text-sm font-semibold tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm leading-snug">{l.when}</span>
                <span className="mt-1 block text-base font-semibold leading-snug">
                  {l.tel
                    ? <a href={`tel:${l.tel.replace(/[^\d+]/g, "")}`} className="underline underline-offset-4">{l.action}</a>
                    : l.action}
                </span>
                {l.note && <span className="mt-1 block text-sm text-muted-foreground">{l.note}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
