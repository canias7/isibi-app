import * as React from "react";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * How protected an account is — as a CHECKLIST, not a percentage.
 *
 * "Your security score is 68%" is a number with no unit, no scale anybody has
 * agreed, and no action attached. It also lies in both directions: an account
 * with a strong password and no second factor is not two-thirds safe, and the
 * one thing left undone is usually worth more than everything already done.
 *
 * So this counts DONE OUT OF TOTAL and puts the undone items first, each with
 * the button that fixes it. The single most useful line on the screen is the
 * next thing to press.
 *
 * Items are marked done by a tick AND by position, never by colour: a list
 * where the only difference between rows is green and grey conveys nothing in
 * greyscale or to anyone who cannot separate the two.
 *
 * An item can be `optional`, which is excluded from the count. Counting a
 * hardware key against a barber shop's customer makes the list permanently
 * incomplete for something they should never do, and a checklist that can never
 * be finished stops being read.
 */
export function SecurityScore({ items, className }: {
  items: { key: string; label: React.ReactNode; hint?: React.ReactNode; done?: boolean; optional?: boolean; action?: React.ReactNode }[];
  className?: string;
}) {
  const counted = items.filter((i) => !i.optional);
  const done = counted.filter((i) => i.done).length;
  const ordered = [...items].sort((a, b) => Number(!!a.done) - Number(!!b.done));

  return (
    <div data-slot="security-score" className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-baseline gap-2">
        <p className="text-sm">
          <strong className="tabular-nums">{done}</strong>
          <span className="text-muted-foreground"> of {counted.length} done</span>
        </p>
        {done === counted.length ? (
          <span className="text-xs text-muted-foreground">Everything important is set up.</span>
        ) : null}
      </div>
      <ul className="divide-y divide-border rounded-md border border-border">
        {ordered.map((i) => (
          <li key={i.key} className="flex items-start gap-3 p-3">
            {i.done
              ? <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
              : <Circle aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm", i.done ? "text-muted-foreground" : "font-medium")}>
                {i.label}
                {i.optional ? <span className="ms-2 text-xs font-normal text-muted-foreground">Optional</span> : null}
                <span className="sr-only">{i.done ? " — done" : " — not done yet"}</span>
              </p>
              {i.hint && !i.done ? <p className="mt-0.5 text-xs text-muted-foreground">{i.hint}</p> : null}
            </div>
            {!i.done && i.action ? <div className="shrink-0">{i.action}</div> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
