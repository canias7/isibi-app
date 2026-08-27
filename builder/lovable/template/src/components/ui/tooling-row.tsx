import { cn } from "@/lib/utils";
/**
 * A tool, die or fixture — where it is and how much life it has left.
 *
 * LIFE IS COUNTED IN CYCLES, NOT DAYS. A die rated for 200,000 hits reaches
 * that in a month on one job and in three years on another, and a
 * date-based service schedule either wastes the tool or breaks it mid-run.
 *
 * IT WARNS BEFORE THE RUN, NOT DURING IT. The useful moment is "this tool has
 * 4,000 hits left and the next order is 6,000" — before it is loaded, while
 * regrinding it is a scheduling decision rather than a stopped line.
 *
 * WHERE IT PHYSICALLY IS forms half the record. Tools live in a rack, in a
 * machine, or at a sharpening contractor, and the third is the one that takes a
 * fortnight and gets forgotten until somebody goes looking.
 *
 * A TOOL OUT FOR SERVICE HAS A RETURN DATE OR SAYS IT HAS NONE. "At the
 * grinders" with no date is how a tool disappears for a quarter.
 */
export function ToolingRow({ tool, location, cyclesUsed, cyclesRated, nextRunCycles, outForService, expectedBack, className }: {
  tool: string;
  /** "Rack 4", "Press 2", "At Sharpe & Co". */
  location?: string;
  cyclesUsed?: number;
  /** Life between services. */
  cyclesRated?: number;
  /** What the next order needs. */
  nextRunCycles?: number;
  outForService?: boolean;
  /** Free text — "14 August". */
  expectedBack?: string;
  className?: string;
}) {
  const left = cyclesUsed !== undefined && cyclesRated !== undefined ? Math.max(0, cyclesRated - cyclesUsed) : undefined;
  const wontLast = left !== undefined && nextRunCycles !== undefined && nextRunCycles > left;
  return (
    <li data-slot="tooling-row" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">{tool}</span>
        {left !== undefined && (
          <span className={cn("shrink-0 tabular-nums", wontLast && "font-medium")}>
            {left.toLocaleString()} {left === 1 ? "cycle" : "cycles"} left
          </span>
        )}
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {location ?? "Location not recorded"}
        {cyclesUsed !== undefined && cyclesRated !== undefined && ` · ${cyclesUsed.toLocaleString()} of ${cyclesRated.toLocaleString()} used`}
      </p>
      {wontLast && nextRunCycles !== undefined && left !== undefined && (
        <p className="text-xs font-medium tabular-nums">
          The next run needs {nextRunCycles.toLocaleString()} — it will run out {(nextRunCycles - left).toLocaleString()} short.
        </p>
      )}
      {outForService && (
        <p className="text-xs font-medium">
          {expectedBack ? `Out for service, back ${expectedBack}.` : "Out for service with no return date recorded."}
        </p>
      )}
    </li>
  );
}
