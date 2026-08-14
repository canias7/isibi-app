import * as React from "react";
import { cn, scrollBehavior } from "@/lib/utils";
/**
 * A scrolling conversation that follows new messages — unless you have scrolled
 * up.
 *
 * That exception is the entire component. A view that always scrolls to the
 * bottom yanks the page away from somebody reading an earlier answer, on every
 * token of a stream — which makes reading back during a long generation
 * impossible. So it tracks whether the reader is AT the bottom and only follows
 * when they are.
 *
 * "At the bottom" needs a TOLERANCE. Fractional device pixels and a zoomed page
 * mean `scrollTop + clientHeight` is often a pixel or two short of
 * `scrollHeight`, so an exact comparison is false almost always and the view
 * never follows anything.
 *
 * When it has stopped following there is a button back down, with a count of
 * what arrived — otherwise the reader has no idea anything happened, and no
 * quick way back.
 *
 * `overflow-anchor: none`, because the browser's own scroll anchoring fights
 * this: it pins the viewport to an element as content grows, which produces a
 * scroll position neither we nor the reader chose.
 */
export function TranscriptView({ children, deps = [], className }: {
  children: React.ReactNode;
  deps?: React.DependencyList;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [follow, setFollow] = React.useState(true);
  const [missed, setMissed] = React.useState(0);

  const atBottom = () => {
    const el = ref.current;
    if (!el) return true;
    // A few pixels of tolerance: fractional pixels mean an exact test is
    // essentially never true.
    return el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (follow) { el.scrollTop = el.scrollHeight; setMissed(0); }
    else setMissed((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return (
    <div className={cn("relative", className)}>
      <div
        ref={ref}
        onScroll={() => {
          const bottom = atBottom();
          setFollow(bottom);
          if (bottom) setMissed(0);
        }}
        className="h-full overflow-y-auto [overflow-anchor:none]"
      >
        {children}
      </div>
      {!follow && missed > 0 ? (
        <button
          type="button"
          onClick={() => {
            const el = ref.current;
            if (el) el.scrollTo({ top: el.scrollHeight, behavior: scrollBehavior() });
            setFollow(true);
            setMissed(0);
          }}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 cursor-pointer rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-md"
        >
          {missed === 1 ? "1 new message" : `${missed} new messages`} &darr;
        </button>
      ) : null}
    </div>
  );
}
