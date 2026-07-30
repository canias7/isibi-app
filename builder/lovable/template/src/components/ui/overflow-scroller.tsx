import { cn } from "@/lib/utils";
/**
 * Content wider than the page, scrolling inside its own box.
 *
 * The rule this enforces: wide things scroll themselves, the page body never
 * scrolls sideways. Edge fades hint that there is more, which a bare
 * overflow-x-auto does not.
 */
export function OverflowScroller({ fade = true, className, children }: {
  fade?: boolean; className?: string; children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative", fade &&
      "[mask-image:linear-gradient(90deg,transparent,#000_16px,#000_calc(100%-16px),transparent)]")}>
      <div className={cn("overflow-x-auto", className)}>{children}</div>
    </div>
  );
}
