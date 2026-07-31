import * as React from "react";
import { useAsyncValidation } from "@/components/ui/async-validation";
import { cn } from "@/lib/utils";
/**
 * "That name is taken — these are free": the check plus the way out.
 *
 * A REFUSAL WITHOUT AN ALTERNATIVE IS A DEAD END. The person who wanted
 * "fade-and-blade" does not want an error, they want a name — so the
 * caller's `check` returns the free alternatives it already knows
 * (suggest-2, suggest-with-town…), and each is ONE CLICK to apply.
 * Suggestions must be VERIFIED FREE by the caller: offering a taken
 * alternative is the same dead end with extra steps.
 *
 * Built on useAsyncValidation (one implementation of debounce + stale-
 * discard), so a slow answer about "fade" can never overwrite the verdict
 * on "fade-and-blade" — with sequential typing that is the common case.
 *
 * "TAKEN" NEVER SAYS BY WHOM. A uniqueness check that names the holder is
 * an enumeration oracle over your customer list (the repo's 404-not-403
 * rule, form-sized).
 */
export function UniquenessCheck({ value, onPick, check, className }: {
  value: string;
  onPick: (suggestion: string) => void;
  check: (value: string) => Promise<{ ok: boolean; suggestions?: string[] }>;
  className?: string;
}) {
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const state = useAsyncValidation(value, async (v) => {
    const res = await check(v);
    setSuggestions(res.ok ? [] : (res.suggestions ?? []));
    return { ok: res.ok, message: res.ok ? "Available." : "Already taken." };
  });

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {state.status === "checking" ? <p className="text-xs text-muted-foreground">Checking…</p> : null}
      {state.status === "ok" ? <p className="text-xs text-muted-foreground">Available.</p> : null}
      {state.status === "failed" ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium">Already taken.</p>
          {suggestions.length ? (
            <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              Free:
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => onPick(s)}
                  className="cursor-pointer rounded-full border border-border px-2 py-0.5 font-mono hover:border-foreground">
                  {s}
                </button>
              ))}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
