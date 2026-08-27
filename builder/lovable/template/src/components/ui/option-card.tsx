import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * One choice in a set, as a selectable card.
 *
 * IT IS A REAL RADIO UNDERNEATH. A card with an onClick is unreachable by
 * keyboard and announces nothing about being one of a set — arrow keys, the
 * group name and "2 of 4" all come free from a radio and from nothing else.
 * Same reasoning as `radio-cards` and `role-picker`.
 *
 * THE WHOLE CARD IS THE TARGET, via a label wrapping the input, rather than
 * only the small circle. On a phone a 16px radio beside a 300px card is a
 * target people miss.
 *
 * A DISABLED OPTION KEEPS ITS REASON. "Sold out" and "needs the Pro plan" are
 * different dead ends with different next steps, and a greyed card with neither
 * is the commonest way a chooser frustrates somebody.
 *
 * The selected state is a border, a tick AND a background — three channels,
 * because this is often the only selection on the screen and missing it means
 * submitting the wrong thing.
 */
export function OptionCard({
  name, value, checked, onChange, title, description, price, badge, disabled, reason, footer, className,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  price?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
  reason?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <label data-slot="option-card" className={cn("relative flex cursor-pointer flex-col gap-1 rounded-lg border p-3",
      checked ? "border-foreground bg-muted/50" : "border-border hover:bg-muted/40",
      disabled && "cursor-default opacity-60 hover:bg-transparent", className)}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <div className="flex items-start gap-2">
        <span aria-hidden className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
          checked ? "border-foreground bg-foreground text-background" : "border-muted-foreground")}>
          {checked ? <Check className="size-2.5" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-medium">{title}</span>
            {badge ? <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{badge}</span> : null}
          </span>
          {description ? <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span> : null}
          {disabled && reason ? <span className="mt-0.5 block text-xs font-medium">{reason}</span> : null}
        </span>
        {price ? <span className="shrink-0 text-sm font-semibold tabular-nums">{price}</span> : null}
      </div>
      {footer ? <div className="mt-1 border-t border-border pt-2 text-xs text-muted-foreground">{footer}</div> : null}
    </label>
  );
}
