import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The button at the end of a list that fetches the next batch.
 *
 * FOCUS MOVES TO THE FIRST NEW ITEM. Without it, a keyboard user presses Load
 * more, twenty rows appear somewhere above, and focus is still on a button that
 * has moved down the page — so the new content is only reachable by tabbing
 * backwards through everything already read.
 *
 * The count of what ARRIVED is announced, politely. A list growing silently is
 * no feedback at all for somebody not looking at it, and "20 more loaded, 60 of
 * 340" is the whole story in one line.
 *
 * It says how many REMAIN when that is known, so the reader can judge whether
 * to keep pressing or narrow the filter instead. "Load more" with no
 * denominator is a button that might need pressing twice or forty times.
 *
 * Unlike `infinite-scroll` this never fires on its own, which makes it the
 * right choice above a footer — the reason infinite scrolling is the wrong
 * pattern for most pages.
 */
export function LoadMore({
  onLoad, loading, remaining, loaded, total, focusRef, error, className,
}: {
  onLoad: () => void;
  loading?: boolean;
  remaining?: number;
  loaded?: number;
  total?: number;
  focusRef?: React.RefObject<HTMLElement | null>;
  error?: React.ReactNode;
  className?: string;
}) {
  const was = React.useRef(loaded);
  const [said, setSaid] = React.useState("");

  React.useEffect(() => {
    if (loaded == null || was.current == null || loaded <= was.current) { was.current = loaded; return; }
    const added = loaded - was.current;
    was.current = loaded;
    setSaid(`${added} more loaded${total != null ? `, ${loaded} of ${total}` : ""}`);
    focusRef?.current?.focus();
  }, [loaded, total, focusRef]);

  if (remaining === 0) {
    return <p className={cn("py-3 text-center text-xs text-muted-foreground", className)}>That&rsquo;s everything.</p>;
  }
  return (
    <div className={cn("flex flex-col items-center gap-2 py-3", className)}>
      {error ? <p role="alert" className="text-xs font-medium">{error}</p> : null}
      <button type="button" onClick={onLoad} disabled={loading}
        className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:pointer-events-none disabled:opacity-60">
        {loading ? "Loading…" : remaining != null ? `Load ${Math.min(remaining, 20)} more` : "Load more"}
      </button>
      {loaded != null ? (
        <p className="text-xs text-muted-foreground tabular-nums">
          {loaded.toLocaleString()}{total != null ? ` of ${total.toLocaleString()}` : null} shown
        </p>
      ) : null}
      <p aria-live="polite" className="sr-only">{said}</p>
    </div>
  );
}
