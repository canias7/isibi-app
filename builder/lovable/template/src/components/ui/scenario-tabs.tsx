import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Best case, likely, worst case — side by side rather than one at a time.
 *
 * REAL TABS with arrow keys and one tab stop, because these are alternative
 * readings of one thing rather than three separate sections.
 *
 * THE HEADLINE FIGURE IS ON THE TAB ITSELF. A scenario picker whose numbers only
 * appear after selection makes the reader click all three and remember; putting
 * the figure on the tab makes the comparison the thing you see first, which is
 * the entire reason to offer scenarios.
 *
 * Tabs keep a stable width so the row does not jump as figures change length —
 * a picker that reflows under the pointer is a picker people misclick.
 */
export type Scenario = { key: string; label: string; headline: string };

export function ScenarioTabs({ scenarios, value, onChange, children, className }: {
  scenarios: Scenario[];
  value: string; onChange: (key: string) => void;
  children?: React.ReactNode;
  className?: string;
}) {
  const id = React.useId();
  if (!scenarios.length) return null;
  const active = scenarios.some((s) => s.key === value) ? value : scenarios[0].key;
  return (
    <div data-slot="scenario-tabs" className={cn("flex flex-col gap-3", className)}>
      <div role="tablist" aria-label="Scenario" className="flex gap-1 rounded-md border border-border bg-muted p-1"
        onKeyDown={(e) => {
          const i = scenarios.findIndex((s) => s.key === active);
          if (e.key === "ArrowRight") { e.preventDefault(); onChange(scenarios[(i + 1) % scenarios.length].key); }
          if (e.key === "ArrowLeft") { e.preventDefault(); onChange(scenarios[(i - 1 + scenarios.length) % scenarios.length].key); }
        }}>
        {scenarios.map((s) => (
          <button key={s.key} role="tab" type="button"
            aria-selected={s.key === active} aria-controls={`${id}-p`}
            tabIndex={s.key === active ? 0 : -1} onClick={() => onChange(s.key)}
            className={cn("flex flex-1 cursor-pointer flex-col rounded px-3 py-1.5 text-start",
              s.key === active ? "bg-background" : "text-muted-foreground hover:text-foreground")}>
            <span className="text-xs">{s.label}</span>
            <span className="text-sm font-medium tabular-nums">{s.headline}</span>
          </button>
        ))}
      </div>
      <div id={`${id}-p`} role="tabpanel">{children}</div>
    </div>
  );
}
