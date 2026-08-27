import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Which version wins. The half that decides, next to `conflict-diff`, which shows.
 *
 * A real `radiogroup` rather than two buttons, so arrow keys move between the
 * options and a screen reader announces "1 of 3" — this is a choice among
 * alternatives, not two separate actions, and the markup should say which.
 *
 * NOTHING IS PRESELECTED. A default here is a thumb on the scale: whichever
 * side is chosen for the reader is the one that gets kept when they press
 * confirm without reading, and losing somebody's work by default is the exact
 * failure this whole screen exists to prevent. The confirm button stays
 * disabled until they say.
 *
 * "Keep both" is offered only when the caller can actually do it — for a text
 * field that usually means appending, and for a booking it is meaningless.
 */
export function ConflictChoice({
  field, mine, theirs, allowBoth, onResolve, busy, className,
}: {
  field?: string;
  mine: string;
  theirs: string;
  /** Offer "keep both" — only where merging is genuinely possible. */
  allowBoth?: boolean;
  onResolve: (choice: "mine" | "theirs" | "both") => void;
  busy?: boolean;
  className?: string;
}) {
  const [pick, setPick] = React.useState<"mine" | "theirs" | "both" | null>(null);
  const id = React.useId();
  const options: { key: "mine" | "theirs" | "both"; label: string; value: string }[] = [
    { key: "mine", label: "Keep yours", value: mine },
    { key: "theirs", label: "Keep theirs", value: theirs },
    ...(allowBoth ? [{ key: "both" as const, label: "Keep both", value: `${mine}\n${theirs}` }] : []),
  ];

  return (
    <div data-slot="conflict-choice" className={cn("flex flex-col gap-3", className)}>
      <div role="radiogroup" aria-label={field ? `Resolve ${field}` : "Resolve conflict"}
        className="flex flex-col gap-2">
        {options.map((o) => (
          <label key={o.key} htmlFor={`${id}-${o.key}`}
            className={cn("flex cursor-pointer gap-3 rounded-md border p-3",
              pick === o.key ? "border-foreground" : "border-border")}>
            <input type="radio" id={`${id}-${o.key}`} name={id} value={o.key}
              checked={pick === o.key} onChange={() => setPick(o.key)}
              className="mt-1 size-4 accent-foreground" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{o.label}</span>
              <span className="mt-0.5 block text-sm whitespace-pre-wrap text-muted-foreground">{o.value}</span>
            </span>
          </label>
        ))}
      </div>
      <div>
        <Button disabled={!pick || busy} onClick={() => pick && onResolve(pick)}>
          {busy ? "Saving…" : "Use this version"}
        </Button>
      </div>
    </div>
  );
}
