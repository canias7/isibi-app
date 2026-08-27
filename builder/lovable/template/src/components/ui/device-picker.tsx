import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Pick the make, then the model. Every price and turnaround after it depends on
 * the answer.
 *
 * TWO STEPS, NOT ONE LONG LIST. A repair shop covers a few hundred models and a
 * single flat `<select>` of them is unusable on a phone, which is where this is
 * read — usually by somebody holding the cracked thing in their other hand.
 * Make first cuts it to a dozen.
 *
 * THE MODEL LIST IS NOT A DROPDOWN EITHER. People do not know whether theirs is
 * a 14 or a 14 Pro, and a dropdown that has to be opened, scrolled and closed to
 * find out makes them guess. Laid out as buttons, the whole range is visible at
 * once and the answer is recognised rather than recalled.
 *
 * "NOT SURE" IS A REAL ANSWER AND IS OFFERED FIRST-CLASS. Somebody who cannot
 * identify their model is precisely the customer who most needs the shop, and
 * every picker that forces a choice loses them at this step. It resolves to the
 * make with no model, which the caller can price as a range or answer with
 * "bring it in".
 *
 * CHANGING THE MAKE CLEARS THE MODEL. Without that, picking Samsung after
 * picking an iPhone 13 leaves the old model selected under a new make and the
 * page quotes for a device that does not exist — a stale-derived-state bug that
 * is invisible until somebody is charged for it.
 */
export type Make = { make: string; models: string[] };
export function DevicePicker({
  makes, value, onChange, unsureLabel = "Not sure which one", className,
}: {
  makes: Make[];
  /** Controlled when supplied. `model` null means the make with no model. */
  value?: { make: string; model: string | null } | null;
  onChange?: (v: { make: string; model: string | null }) => void;
  unsureLabel?: string;
  className?: string;
}) {
  const [own, setOwn] = React.useState<{ make: string; model: string | null } | null>(null);
  const picked = value ?? own;
  const set = (v: { make: string; model: string | null }) => (onChange ? onChange(v) : setOwn(v));
  const models = makes.find((m) => m.make === picked?.make)?.models ?? [];
  const chip = (on: boolean) =>
    cn("rounded-md border px-3.5 py-2 text-sm", on ? "border-foreground bg-foreground font-medium text-background" : "border-border");
  if (!makes.length) return null;
  return (
    <div data-slot="device-picker" className={cn("space-y-6", className)}>
      <fieldset>
        <legend className="text-sm font-medium">What is it?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {makes.map((m) => (
            <button
              key={m.make} type="button" aria-pressed={picked?.make === m.make}
              // Clearing the model is the whole point — carrying it across a
              // make change quotes for a device nobody owns.
              onClick={() => set({ make: m.make, model: null })}
              className={chip(picked?.make === m.make)}
            >
              {m.make}
            </button>
          ))}
        </div>
      </fieldset>

      {picked && models.length > 0 && (
        <fieldset>
          <legend className="text-sm font-medium">Which {picked.make}?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {models.map((mo) => (
              <button
                key={mo} type="button" aria-pressed={picked.model === mo}
                onClick={() => set({ make: picked.make, model: mo })}
                className={chip(picked.model === mo)}
              >
                {mo}
              </button>
            ))}
            <button
              type="button" aria-pressed={picked.model === null}
              onClick={() => set({ make: picked.make, model: null })}
              className={cn(chip(picked.model === null), "border-dashed")}
            >
              {unsureLabel}
            </button>
          </div>
          {picked.model === null && (
            <p className="mt-3 text-sm text-muted-foreground">
              That is fine — the model is written in the settings, or bring it in and we will look.
              The prices below are the range across the {picked.make} models we do.
            </p>
          )}
        </fieldset>
      )}
    </div>
  );
}
