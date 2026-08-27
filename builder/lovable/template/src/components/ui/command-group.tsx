import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A titled section inside a command palette's listbox.
 *
 * `role="group"` WITH `aria-labelledby` pointing at its own heading — the
 * structure that lets a screen reader say "Navigation, group" instead of
 * flattening twelve options into an unlabelled soup. The heading id is
 * generated, so two groups never collide.
 *
 * THE HEADING IS NOT AN OPTION: it is presentation between options, so it
 * carries no role that would make it selectable, and arrow-key logic in
 * the caller can skip it by only walking `[role="option"]`.
 *
 * EMPTY GROUPS RENDER NOTHING. A filtered palette showing "Settings" with
 * no rows under it reads as a bug; the caller filters items, the group
 * disappears with them (children count is the test — cheap and honest).
 */
export function CommandGroup({ title, children, className }: {
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const id = React.useId();
  const count = React.Children.count(children);
  if (count === 0) return null;
  return (
    <div data-slot="command-group" role="group" aria-labelledby={id} className={cn("py-1", className)}>
      <p id={id} className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}
