import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Which environment preferences are live right now. A BUILD TOOL, gated on
 * `active`, like tab-order-note and breakpoint-badge.
 *
 * IT ANSWERS "WHY DOES IT LOOK LIKE THAT HERE" — the debugging session
 * where reduced-motion, forced dark, or a coarse pointer is quietly
 * changing behaviour and nobody remembers their OS setting. The queries
 * listed are the ones this kit actually branches on, so the badge is an
 * audit of the real inputs, not trivia.
 *
 * LIVE, not a snapshot: each query re-renders on change, so toggling the
 * OS setting shows up without a reload — which is itself the test that
 * the components listening to these queries will update too.
 */
const QUERIES: [string, string][] = [
  ["reduced motion", "(prefers-reduced-motion: reduce)"],
  ["more contrast", "(prefers-contrast: more)"],
  ["dark scheme", "(prefers-color-scheme: dark)"],
  ["can hover", "(hover: hover)"],
  ["coarse pointer", "(pointer: coarse)"],
];

export function MediaQueryNote({ active, className }: { active: boolean; className?: string }) {
  const [state, setState] = React.useState<Record<string, boolean>>({});
  React.useEffect(() => {
    if (!active || typeof matchMedia === "undefined") return;
    const lists = QUERIES.map(([name, q]) => {
      const mq = matchMedia(q);
      const read = () => setState((s) => ({ ...s, [name]: mq.matches }));
      read();
      mq.addEventListener("change", read);
      return { mq, read };
    });
    return () => lists.forEach(({ mq, read }) => mq.removeEventListener("change", read));
  }, [active]);
  if (!active) return null;
  return (
    <div data-slot="media-query-note" aria-hidden className={cn(
      "fixed bottom-3 end-3 z-50 flex flex-col gap-0.5 rounded-md border border-foreground bg-popover px-2.5 py-1.5 font-mono text-[11px] shadow-sm",
      className)}>
      <span className="text-muted-foreground">environment · build tool</span>
      {QUERIES.map(([name]) => (
        <span key={name} className="flex items-center gap-1.5">
          <span className={cn("size-1.5 rounded-full border border-foreground", state[name] ? "bg-foreground" : "bg-transparent")} />
          {name}: <span className="font-bold">{state[name] ? "yes" : "no"}</span>
        </span>
      ))}
    </div>
  );
}
