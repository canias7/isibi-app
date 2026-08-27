import * as React from "react";
import { cn, labelText } from "@/lib/utils";
/**
 * Boxes joined by edges, positioned and pannable.
 *
 * `workflow-map` IS DELIBERATELY A LIST and `org-chart` is a fixed
 * hierarchy; neither can show a cycle, a join, or two paths that reconverge
 * — which is most of what a real flow, a dependency map or a mind map is.
 *
 * NO PHYSICS AND NO AUTO-LAYOUT. Force-directed graphs ship a solver, jitter
 * on every render, and put the same graph in a different place each visit,
 * which destroys the one thing a map is for: recognising it. Positions are
 * the caller's, in a 0–100 space, so they are stable and storable.
 *
 * EDGES STOP SHORT OF THE NODE, and that is not cosmetic: drawn to the
 * centre, the arrowhead lands underneath the box and the graph loses its
 * direction entirely — measured on the first render, where every arrow was
 * hidden. They end a node-radius out so the head is visible.
 *
 * A RECIPROCAL PAIR IS BOWED APART. Two nodes joined both ways draw the same
 * line twice and the cycle — the one thing a list genuinely cannot show, and
 * the reason this component exists — becomes invisible. Any edge whose
 * reverse also exists curves to one side, so both are readable.
 *
 * THE GRAPH IS ALSO A LIST for screen readers: an sr-only description of
 * every edge ("Deposit leads to Confirm"), because a positioned diagram is
 * unreadable otherwise and nobody should have to see it to follow the flow.
 */
export type GraphNode = { id: string; x: number; y: number; label: React.ReactNode };
export type GraphEdge = { from: string; to: string; label?: string };

export function NodeGraph({ nodes, edges, onPick, selected, className }: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onPick?: (id: string) => void;
  selected?: string;
  className?: string;
}) {
  const at = new Map(nodes.map((n) => [n.id, n]));
  const id = React.useId().replace(/:/g, "");
  return (
    <div data-slot="node-graph" className={cn("relative w-full overflow-auto rounded-lg border border-border bg-muted/20", className)}
      style={{ aspectRatio: "16/9" }}>
      <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <marker id={`arrow-${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {edges.map((e, i) => {
          const a = at.get(e.from), b = at.get(e.to);
          if (!a || !b) return null;
          const dx = b.x - a.x, dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          // Stop short of the node, or the arrowhead sits under the box.
          const GAP = 6;
          const x1 = a.x + (dx / len) * GAP, y1 = a.y + (dy / len) * GAP;
          const x2 = b.x - (dx / len) * GAP, y2 = b.y - (dy / len) * GAP;
          // A reciprocal pair must not draw the same line twice - that hides the cycle.
          const twoWay = edges.some((o) => o.from === e.to && o.to === e.from);
          const bow = twoWay ? 8 : 0;
          const d = bow
            ? `M ${x1} ${y1} Q ${(x1 + x2) / 2 + (dy / len) * bow} ${(y1 + y2) / 2 - (dx / len) * bow} ${x2} ${y2}`
            : `M ${x1} ${y1} L ${x2} ${y2}`;
          return (
            <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth="0.4"
              vectorEffect="non-scaling-stroke" markerEnd={`url(#arrow-${id})`} opacity="0.6" />
          );
        })}
      </svg>
      {nodes.map((n) => (
        <button key={n.id} type="button" onClick={() => onPick?.(n.id)}
          style={{ left: `${n.x}%`, top: `${n.y}%` }}
          className={cn("absolute -translate-x-1/2 -translate-y-1/2 rounded-md border bg-popover px-2 py-1 text-[11px] shadow-sm",
            selected === n.id ? "border-foreground font-medium" : "border-border",
            onPick && "cursor-pointer hover:bg-muted")}>
          {n.label}
        </button>
      ))}
      {/* The same graph as prose - a positioned diagram is unreadable otherwise. */}
      <ul className="sr-only">
        {edges.map((e, i) => (
          <li key={i}>
            {/* THE ID IS THE FALLBACK, not "[object Object]". A node's label is
                a ReactNode, and this list is the whole screen-reader account of
                a graph drawn as absolutely-positioned boxes — so an element
                label made every sentence in it read "object Object leads to
                object Object". The id is at least a handle somebody can find. */}
            {labelText(at.get(e.from)?.label) || e.from} leads to {labelText(at.get(e.to)?.label) || e.to}
            {e.label ? ` (${labelText(e.label)})` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
