import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The whole state machine as a diagram — every state and every legal move.
 *
 * IT IS A LIST, NOT A GRAPH LAYOUT. Auto-laying-out a state machine needs a
 * layout engine and produces something unreadable past six nodes; a state per
 * row with its outgoing moves beneath is legible at any size, prints, and works
 * with a screen reader. That is a deliberate trade rather than a limitation.
 *
 * THE CURRENT STATE IS MARKED and its moves come first, because the question at
 * a real record is "where can this go from here", and everything else is
 * reference.
 *
 * UNREACHABLE STATES ARE FLAGGED. A state with nothing pointing at it is
 * almost always a mistake in the workflow, and it is invisible in a list until
 * something computes it — which is one pass over the transitions.
 *
 * TERMINAL states are marked too, because a state machine with no terminal
 * state is the other common mistake.
 */
export type Move = { from: string; to: string; label?: string };

export function WorkflowMap({ states, moves, current, className }: {
  states: { key: string; label: string }[];
  moves: Move[];
  current?: string;
  className?: string;
}) {
  const incoming = new Set(moves.map((m) => m.to));
  const first = states[0]?.key;
  const ordered = current
    ? [...states.filter((s) => s.key === current), ...states.filter((s) => s.key !== current)]
    : states;

  return (
    <ul data-slot="workflow-map" className={cn("flex flex-col divide-y divide-border rounded-md border border-border", className)}>
      {ordered.map((s) => {
        const out = moves.filter((m) => m.from === s.key);
        // Nothing points here and it is not the start: almost always a mistake.
        const orphan = !incoming.has(s.key) && s.key !== first;
        return (
          <li key={s.key} className={cn("p-3", s.key === current && "bg-muted/50")}>
            <p className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="font-medium">{s.label}</span>
              {s.key === current ? (
                <span className="rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background">Now</span>
              ) : null}
              {out.length === 0 ? <span className="text-xs text-muted-foreground">final state</span> : null}
              {orphan ? <span className="text-xs font-medium">nothing leads here</span> : null}
            </p>
            {out.length ? (
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {out.map((m) => (
                  <li key={m.to} className="rounded-full border border-border px-2 py-0.5 text-xs">
                    {m.label ?? "goes to"}{" "}
                    <span className="font-medium">{states.find((x) => x.key === m.to)?.label ?? m.to}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
