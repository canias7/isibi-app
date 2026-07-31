import * as React from "react";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { cn } from "@/lib/utils";
/**
 * Two panes with a draggable divider.
 *
 * IT STACKS BELOW `md` and the divider disappears. A 50/50 split on a 375px
 * screen is two unusable columns; below the breakpoint the panes become
 * sections one after the other, which is the same call `split-view` makes.
 *
 * The split is PERSISTED by name. Somebody who widens the preview means it, and
 * a shell that forgets on every navigation makes them do it again all day.
 * `localStorage` in a try/catch, because it throws outright in a Safari private
 * window.
 *
 * `collapse` snaps a pane fully shut and remembers the width to reopen at, so
 * "hide the sidebar" is one press rather than a drag to the edge — which is
 * also the drag that loses the handle.
 *
 * The divider is `resize-handle`, so the arrow keys and the minimum come for
 * free rather than being restated here.
 */
export function useSplit(name: string, initial = 50) {
  const [value, setValue] = React.useState(initial);
  React.useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(`split:${name}`));
      if (Number.isFinite(saved) && saved > 0) setValue(saved);
    } catch { /* private mode */ }
  }, [name]);
  const set = React.useCallback((next: number) => {
    setValue(next);
    try { localStorage.setItem(`split:${name}`, String(Math.round(next))); } catch { /* as above */ }
  }, [name]);
  return [value, set] as const;
}

export function SplitPane({
  first, second, value, onChange, onReset, min = 15, max = 85, collapsed, firstLabel, secondLabel, className,
}: {
  first: React.ReactNode;
  second: React.ReactNode;
  value: number;
  onChange: (percent: number) => void;
  onReset?: () => void;
  min?: number;
  max?: number;
  collapsed?: boolean;
  firstLabel?: string;
  secondLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-col md:flex-row", className)}>
      <section
        aria-label={firstLabel}
        style={{ width: collapsed ? 0 : undefined }}
        className={cn("min-w-0 overflow-auto md:[width:var(--split)]", collapsed && "hidden md:block md:w-0")}
        // The custom property is the only way to feed a runtime percentage into
        // a class-driven width without building a class name Tailwind cannot see.
        ref={(el) => { if (el) el.style.setProperty("--split", `${value}%`); }}
      >
        {first}
      </section>
      {collapsed ? null : (
        <ResizeHandle value={value} onChange={onChange} onReset={onReset} min={min} max={max}
          label="Resize the panes" className="hidden md:block" />
      )}
      <section aria-label={secondLabel} className="min-w-0 flex-1 overflow-auto">{second}</section>
    </div>
  );
}
