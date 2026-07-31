import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * LOCAL EDIT — do not lose this to `npx shadcn add --overwrite`.
 *
 * The stock new-york checkbox renders a TICK for the indeterminate state and
 * styles only `data-[state=checked]`, so a partly-selected group draws as a
 * hollow box with a tick in it — indistinguishable from checked at a glance,
 * and the opposite of what the third state exists to say. Measured on a
 * category filter where one of three children was selected and the parent read
 * as "all of them".
 *
 * `filter-tree`, `tree-select` and `selectable-list` all pass
 * `checked="indeterminate"`, so this belongs here rather than in each of them.
 * The right child is chosen by the Indicator's own `data-state`, which works
 * for uncontrolled use as well as controlled.
 */
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "grid place-content-center peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn(
        "grid place-content-center text-current",
        "[&[data-state=checked]>.cb-partial]:hidden [&[data-state=indeterminate]>.cb-check]:hidden",
      )}
    >
      <Check className="cb-check h-4 w-4" />
      <Minus className="cb-partial h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
