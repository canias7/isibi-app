import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Who this link works for.
 *
 * THE WIDEST OPTION IS NOT THE DEFAULT and is described by what it actually
 * means: "Anyone with the link" rather than "Public". People pick the top option
 * to get on with it, so the top option must be the safe one — this is the
 * control behind most accidental data exposure.
 *
 * EACH OPTION SPELLS OUT ITS CONSEQUENCE. "Anyone with the link — no sign-in,
 * and it can be forwarded" is the sentence that stops somebody choosing it for a
 * document they thought was private.
 *
 * A real `radiogroup`, because these are alternatives rather than independent
 * switches, and arrow keys should move between them.
 */
export type ShareScopeKey = "private" | "invited" | "org" | "link";

export function ShareScope({ value, onChange, orgName, className }: {
  value: ShareScopeKey;
  onChange: (v: ShareScopeKey) => void;
  /** Named so "anyone at Acme" is concrete. */
  orgName?: string;
  className?: string;
}) {
  const id = React.useId();
  const options: { key: ShareScopeKey; label: string; means: string }[] = [
    { key: "private", label: "Only me", means: "Nobody else can open it." },
    { key: "invited", label: "People I invite", means: "Each person is added by name." },
    ...(orgName ? [{ key: "org" as const, label: `Anyone at ${orgName}`, means: "They must be signed in." }] : []),
    { key: "link", label: "Anyone with the link", means: "No sign-in, and it can be forwarded." },
  ];
  return (
    <fieldset className={cn("flex flex-col gap-2", className)}>
      <legend className="mb-1 text-sm font-medium">Who can open this</legend>
      <div role="radiogroup" aria-label="Who can open this" className="flex flex-col gap-2">
        {options.map((o) => (
          <label key={o.key} htmlFor={`${id}-${o.key}`}
            className={cn("flex cursor-pointer gap-3 rounded-md border p-3",
              value === o.key ? "border-foreground" : "border-border")}>
            <input type="radio" id={`${id}-${o.key}`} name={id} checked={value === o.key}
              onChange={() => onChange(o.key)} className="mt-0.5 size-4 accent-foreground" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.means}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
