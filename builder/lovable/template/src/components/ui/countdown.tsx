import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Time until something. Stops at zero rather than counting into the negative.
 *
 * THE FIRST RENDER NEVER READS THE CLOCK, and that is the whole design rather
 * than a detail. This used to seed its state with `target - Date.now()`, which
 * runs on the SERVER during SSR and again in the BROWSER at hydration — and the
 * `sec` field changes every second, so any gap between the two produced
 * different text and React refused the hydration (#418, "text"). Measured: it
 * took down `festival /` and `box-office /event` in the family-app harness,
 * intermittently, because whether it fires is a race against the second hand.
 *
 * IT IS A RACE IN THE HARNESS AND A CERTAINTY IN PRODUCTION. A visitor is a
 * network round trip plus a bundle parse away from the render, which crosses a
 * second boundary most of the time — so most page views logged a console error,
 * and since `error-reporting.ts` POSTs those to the site's own `_errors`, the
 * owner's error panel filled up with one entry per view.
 *
 * SO THE SERVER RENDERS `--` AND THE EFFECT FILLS IT IN ON MOUNT. That reads as
 * a downgrade and is not: the server cannot know this number. Whatever it
 * serialises is stale by the time anybody sees it, so the old behaviour was not
 * "the right answer, early" — it was a wrong answer presented as fact. The cost
 * is one frame of `--`, and a countdown that never counts with JS disabled,
 * which is what a countdown is.
 *
 * NOT `suppressHydrationWarning`, though React documents it for exactly this.
 * It silences the error while leaving the mismatch real, and it has to sit on
 * the precise text node — so it stops covering the moment the tree around it
 * changes, silently. Having no mismatch to suppress is the structural version.
 */
export function Countdown({ to, onDone, className }: {
  to: string | number | Date;
  onDone?: () => void;
  className?: string;
}) {
  const target = React.useMemo(() => new Date(to).getTime(), [to]);
  // `null` is "not mounted yet", which is the one thing the server and the
  // client's first render always agree on.
  const [left, setLeft] = React.useState<number | null>(null);
  // Out of the deps: an inline `onDone` tore down and rebuilt the interval on
  // every parent render.
  const doneRef = React.useRef(onDone);
  doneRef.current = onDone;

  React.useEffect(() => {
    // ONE INTERVAL, KEYED ON THE TARGET ALONE. The old deps included `left`, so
    // it tore the timer down and rebuilt it every second — and now that `left`
    // starts null, re-arming on it would also mean the first tick decides
    // whether there is ever a second one.
    let t: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      const next = Math.max(0, target - Date.now());
      setLeft(next);
      if (next === 0) {
        if (t) clearInterval(t);
        doneRef.current?.();
      }
    };
    tick(); // fill the placeholder in on mount, not a second later
    if (target - Date.now() > 0) t = setInterval(tick, 1000);
    return () => { if (t) clearInterval(t); };
  }, [target]);

  const s = left === null ? null : Math.floor(left / 1000);
  const parts = [
    { v: s === null ? null : Math.floor(s / 86400), l: "days" },
    { v: s === null ? null : Math.floor((s % 86400) / 3600), l: "hrs" },
    { v: s === null ? null : Math.floor((s % 3600) / 60), l: "min" },
    { v: s === null ? null : s % 60, l: "sec" },
  ];
  return (
    <div className={cn("flex gap-4", className)}>
      {parts.map((p) => (
        <div key={p.l} className="flex flex-col items-center">
          <span className="text-2xl font-semibold tabular-nums">
            {p.v === null ? "--" : String(p.v).padStart(2, "0")}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{p.l}</span>
        </div>
      ))}
    </div>
  );
}
