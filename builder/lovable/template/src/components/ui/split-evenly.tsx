import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
/**
 * A bill divided between people, with the odd penny accounted for.
 *
 * THE REMAINDER IS THE WHOLE PROBLEM. £100 between three is not £33.33 each —
 * that leaves a penny, and a component that silently drops it produces a split
 * that does not add up to the bill. One person pays the extra, and this says who.
 *
 * IT SHOWS THE UNEVEN SHARE EXPLICITLY rather than rounding everything up, which
 * would overcharge by two pence. Being one penny out on a restaurant bill is
 * trivial; being visibly unexplained is what people argue about.
 *
 * Integer arithmetic on minor units throughout — dividing floats is how a split
 * ends up at 33.329999999999995.
 */
export function SplitEvenly({ total, people, currency = "GBP", className }: {
  total: number;
  people: number;
  currency?: string;
  className?: string;
}) {
  if (people <= 0) return null;
  const minor = Math.round(total * 100);
  const base = Math.floor(minor / people);
  const extra = minor - base * people;
  return (
    <div className={cn("flex flex-col gap-0.5 text-sm", className)}>
      <p className="tabular-nums">
        <span className="font-medium"><Money amount={base / 100} currency={currency} /> each</span>
        <span className="text-muted-foreground"> between {people}</span>
      </p>
      {extra > 0 && (
        <p className="text-xs text-muted-foreground tabular-nums">
          {extra} {extra === 1 ? "person pays" : "people pay"}{" "}
          <Money amount={(base + 1) / 100} currency={currency} /> to cover the odd{" "}
          {extra === 1 ? "penny" : "pennies"}.
        </p>
      )}
    </div>
  );
}
