import * as React from "react";
import { Lock, Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The gate between two stages — what has to be true before this can move on.
 *
 * IT LISTS EVERY CONDITION, met and unmet, with the unmet ones first. A gate
 * showing only what is missing hides how close it is; showing only a count
 * ("2 of 5") hides which. Both are needed and both are cheap.
 *
 * EACH UNMET CONDITION CARRIES ITS OWN ACTION where there is one. The reason
 * people get stuck at a gate is not knowing where to go, and a link per row
 * answers it without a support message.
 *
 * A CONDITION SOMEBODY ELSE MUST MEET SAYS WHOSE. "Waiting for Grace to
 * approve" is a different situation from "you have not uploaded the photo", and
 * a flat list of unmet conditions conflates them into work you cannot do.
 *
 * The button is DISABLED WITH THE COUNT rather than hidden — the same rule as
 * `change-request`: a vanished control explains nothing.
 */
export function StageGate({ title, conditions, onProceed, proceedLabel = "Continue", className }: {
  title?: React.ReactNode;
  conditions: { key: string; label: React.ReactNode; met?: boolean; who?: React.ReactNode; action?: React.ReactNode }[];
  onProceed?: () => void;
  proceedLabel?: string;
  className?: string;
}) {
  // Unmet first: how close it is matters less than what is missing.
  const ordered = [...conditions].sort((a, b) => Number(!!a.met) - Number(!!b.met));
  const left = conditions.filter((c) => !c.met);

  return (
    <div data-slot="stage-gate" className={cn("flex flex-col gap-3 rounded-lg border border-border p-3", className)}>
      {title ? <p className="text-sm font-semibold">{title}</p> : null}
      <ul className="flex flex-col gap-1.5">
        {ordered.map((c) => (
          <li key={c.key} className="flex items-start gap-2 text-sm">
            {c.met
              ? <Check aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              : <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
            <span className="min-w-0 flex-1">
              <span className={cn(c.met ? "text-muted-foreground" : "font-medium")}>{c.label}</span>
              <span className="sr-only">{c.met ? " — done" : " — still needed"}</span>
              {/* Whose job it is: work you cannot do is a different situation. */}
              {!c.met && c.who ? (
                <span className="block text-xs text-muted-foreground">Waiting for {c.who}</span>
              ) : null}
            </span>
            {!c.met && c.action ? <span className="shrink-0">{c.action}</span> : null}
          </li>
        ))}
      </ul>
      {onProceed ? (
        <div className="flex items-center gap-3">
          <button type="button" onClick={onProceed} disabled={left.length > 0}
            className="cursor-pointer rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:pointer-events-none disabled:opacity-40">
            {proceedLabel}
          </button>
          {left.length ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {left.length} {left.length === 1 ? "thing" : "things"} still needed
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
