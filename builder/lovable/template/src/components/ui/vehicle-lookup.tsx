import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * A registration box that resolves to a vehicle. Everything a garage says after
 * this depends on the answer, so it is the first thing on the page.
 *
 * IT DOES NOT CALL THE DVLA. Looking a plate up is a keyed, paid, rate-limited
 * API, and the key would have to live in the page — so this takes a `onLookup`
 * callback and the site's own backend does it. A component that shipped its own
 * lookup would be a credential in a static bundle.
 *
 * THE PLATE IS NORMALISED, NOT VALIDATED. People type "yc19 abc", "YC19ABC" and
 * "YC19 ABC" in roughly equal numbers, and personalised plates break every
 * format rule anybody writes down — so spaces and case go, and nothing else is
 * refused. Refusing a real registration is worse than accepting an odd one.
 *
 * NOT FOUND IS NOT AN ERROR. A plate no database has seen is the ordinary case
 * for an import or a fresh registration, so it offers the manual way in rather
 * than a red box.
 */
export type Vehicle = { make: string; model: string; year?: number | string; fuel?: string; mot?: string };
export function VehicleLookup({
  onLookup, vehicle, state = "idle", onReset, manualHref, className,
}: {
  onLookup?: (reg: string) => void;
  /** What the site's own backend resolved. */
  vehicle?: Vehicle | null;
  state?: "idle" | "looking" | "found" | "unknown";
  onReset?: () => void;
  /** Where somebody goes when the plate is not recognised. */
  manualHref?: string;
  className?: string;
}) {
  const [reg, setReg] = React.useState("");
  const plate = reg.toUpperCase().replace(/\s+/g, "");
  const id = React.useId();
  if (state === "found" && vehicle) {
    return (
      <div className={cn("rounded-lg border border-border p-4", className)} role="status">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">{vehicle.make} {vehicle.model}</p>
            <p className="text-sm text-muted-foreground">
              {[vehicle.year, vehicle.fuel].filter(Boolean).join(" · ")}
              {vehicle.mot && <> · MOT due {vehicle.mot}</>}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onReset}>Different vehicle</Button>
        </div>
      </div>
    );
  }
  return (
    <form
      className={cn("space-y-3", className)}
      onSubmit={(e) => { e.preventDefault(); if (plate) onLookup?.(plate); }}
    >
      <label htmlFor={id} className="block text-sm font-medium">Your registration</label>
      <div className="flex flex-wrap gap-2">
        {/* A plain input rather than the kit's: a number plate wants its own
            treatment, and `uppercase` on the field means what is typed and what
            is sent already agree. */}
        <input
          id={id} value={reg} onChange={(e) => setReg(e.target.value)}
          autoComplete="off" spellCheck={false}
          placeholder="YC19 ABC" aria-describedby={`${id}-help`}
          className="h-11 w-44 rounded-md border border-border bg-background px-3 text-lg font-semibold uppercase tracking-widest tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" disabled={!plate || state === "looking"}>
          {state === "looking" ? "Looking…" : "Find my vehicle"}
        </Button>
      </div>
      {state === "unknown" ? (
        <p className="text-sm" aria-live="polite">
          We don't have that one on file — plenty of imports and new plates aren't.{" "}
          {manualHref
            ? <a className="font-medium underline underline-offset-4" href={manualHref}>Tell us the make and model instead</a>
            : <>Ring us and we'll sort it.</>}
        </p>
      ) : (
        <p id={`${id}-help`} className="text-sm text-muted-foreground">
          Spaces and capitals don't matter.
        </p>
      )}
    </form>
  );
}
