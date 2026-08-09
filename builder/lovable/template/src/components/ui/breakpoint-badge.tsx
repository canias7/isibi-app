import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A floating badge naming the current Tailwind breakpoint. A BUILD TOOL,
 * like tab-order-note — it says so on its face and is gated on `active`.
 *
 * IT ANSWERS THE QUESTION PEOPLE RESIZE FOR: "which breakpoint am I in
 * right now?" — guessed wrong constantly because the sm/md/lg boundaries
 * are remembered wrong (sm is 640, not "phones"). The badge shows the
 * breakpoint NAME and the live viewport width, both, because the number is
 * what settles arguments.
 *
 * The widths are Tailwind v4's defaults, stated in one table — if the
 * project overrides its theme's breakpoints this badge lies, which is why
 * they are exported for the caller to replace.
 */
export const TAILWIND_BREAKPOINTS: [string, number][] = [
  ["2xl", 1536], ["xl", 1280], ["lg", 1024], ["md", 768], ["sm", 640],
];

export function BreakpointBadge({ active, breakpoints = TAILWIND_BREAKPOINTS, className }: {
  active: boolean;
  breakpoints?: [string, number][];
  className?: string;
}) {
  const [w, setW] = React.useState(0);
  React.useEffect(() => {
    if (!active) return;
    const read = () => setW(window.innerWidth);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, [active]);
  if (!active || !w) return null;
  const name = breakpoints.find(([, px]) => w >= px)?.[0] ?? "base";
  return (
    <div aria-hidden className={cn(
      "fixed bottom-3 left-3 z-50 rounded-md border border-foreground bg-popover px-2 py-1 font-mono text-[11px] shadow-sm",
      className)}>
      <span className="font-bold">{name}</span>
      <span className="text-muted-foreground"> · {w}px · build tool</span>
    </div>
  );
}
