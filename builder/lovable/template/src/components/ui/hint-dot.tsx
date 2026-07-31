import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The small mark that says "there is something new here".
 *
 * IT DISAPPEARS ONCE SEEN, permanently, keyed by a name. A dot that comes back
 * on every page load is not a hint, it is a permanent decoration that people
 * learn to look past — and then the next real one is invisible too. The state
 * is in `localStorage`, in a try/catch, because it throws in a Safari private
 * window.
 *
 * It is `aria-hidden` and paired with visible text. A dot conveys nothing to a
 * screen reader, and an `aria-label` of "new" attached to a decoration
 * clutters the reading of whatever it sits on. If the newness matters, say it
 * in words next to it.
 *
 * The pulse stops for `prefers-reduced-motion`, and the dot stays. Same rule as
 * `live-badge`: the animation is decoration, the mark is the content.
 *
 * It renders NOTHING when dismissed rather than an invisible span, so the
 * layout does not reserve space for a thing that will never come back.
 */
export function useSeen(key: string) {
  const [seen, setSeen] = React.useState(true);
  React.useEffect(() => {
    try { setSeen(localStorage.getItem(`hint:${key}`) === "1"); }
    catch { setSeen(false); }
  }, [key]);
  const markSeen = React.useCallback(() => {
    setSeen(true);
    try { localStorage.setItem(`hint:${key}`, "1"); } catch { /* private mode */ }
  }, [key]);
  return { seen, markSeen };
}

export function HintDot({ name, pulse = true, className }: {
  name?: string;
  pulse?: boolean;
  className?: string;
}) {
  const { seen } = useSeen(name ?? "");
  if (name && seen) return null;
  return (
    <span aria-hidden className={cn("relative inline-flex size-2 shrink-0", className)}>
      {pulse ? (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-foreground opacity-60 motion-reduce:hidden" />
      ) : null}
      <span className="relative inline-flex size-2 rounded-full bg-foreground" />
    </span>
  );
}
