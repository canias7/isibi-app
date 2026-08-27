import * as React from "react";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { cn } from "@/lib/utils";
/**
 * Three or more resizable panels in a row — the general case `split-pane`
 * covers for two.
 *
 * DRAGGING A HANDLE MOVES ONLY THE TWO PANELS IT SITS BETWEEN, and their sizes
 * sum to a constant. The naive version scales every panel proportionally, so
 * widening the sidebar shrinks the inspector on the far side for no reason
 * anybody asked for — the behaviour that makes a three-pane layout feel
 * possessed.
 *
 * THE SIZES ARE NORMALISED to 100 on every change, so rounding cannot
 * accumulate into a layout that no longer fills its container. Three panels of
 * 33.333 drift visibly within a dozen drags otherwise.
 *
 * Each panel has a MINIMUM and it is enforced against its neighbour, not
 * globally: a panel is squeezed to its floor and then the drag stops rather
 * than pushing the shortfall onto a third panel.
 *
 * It stacks below `md`, like `split-pane` — three columns on a phone is three
 * unusable ones.
 */
export function usePanelSizes(initial: number[]) {
  const [sizes, setSizes] = React.useState(initial);
  const resize = React.useCallback((index: number, deltaPercent: number, min = 10) => {
    setSizes((prev) => {
      const next = prev.slice();
      const a = next[index], b = next[index + 1];
      if (a == null || b == null) return prev;
      // Only this pair moves, and their total is preserved.
      const total = a + b;
      const wantA = Math.max(min, Math.min(total - min, a + deltaPercent));
      next[index] = wantA;
      next[index + 1] = total - wantA;
      const sum = next.reduce((n, x) => n + x, 0);
      // Renormalise, or rounding drifts the layout off 100 over time.
      return sum > 0 ? next.map((x) => (x / sum) * 100) : prev;
    });
  }, []);
  return [sizes, resize, setSizes] as const;
}

export function PanelGroup({ panels, sizes, onResize, min = 10, className }: {
  panels: { key: string; label?: string; content: React.ReactNode }[];
  sizes: number[];
  onResize: (index: number, deltaPercent: number, min?: number) => void;
  min?: number;
  className?: string;
}) {
  const wrap = React.useRef<HTMLDivElement>(null);

  return (
    <div data-slot="panel-group" ref={wrap} className={cn("flex min-h-0 flex-col md:flex-row", className)}>
      {panels.map((p, i) => (
        <React.Fragment key={p.key}>
          <section
            aria-label={p.label}
            ref={(el) => { if (el) el.style.setProperty("--w", `${sizes[i] ?? 0}%`); }}
            className="min-w-0 overflow-auto md:[width:var(--w)]"
          >
            {p.content}
          </section>
          {i < panels.length - 1 ? (
            <ResizeHandle
              value={sizes[i] ?? 0}
              min={min}
              max={100 - min}
              label={`Resize ${p.label ?? `panel ${i + 1}`}`}
              onChange={(next) => onResize(i, next - (sizes[i] ?? 0), min)}
              onReset={() => onResize(i, 0, min)}
              className="hidden md:block"
            />
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );
}
