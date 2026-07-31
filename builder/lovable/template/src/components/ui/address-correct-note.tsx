import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "We think this address should be…" — a suggestion, never an edit.
 *
 * AUTO-CORRECTING AN ADDRESS IS HOW PARCELS GO TO THE WRONG STREET. Postal
 * databases are confidently wrong about new builds, flat subdivisions and
 * anything rural, and the person typing knows where they live. So the
 * suggestion is shown BESIDE what they typed, with theirs selected, and it
 * takes a press to accept.
 *
 * THE DIFFERENCE IS HIGHLIGHTED LINE BY LINE. "Did you mean" over two nearly
 * identical blocks is unreadable; marking only the lines that changed is what
 * makes the decision take a second.
 *
 * KEEPING THEIRS IS A FIRST-CLASS BUTTON, not a dismiss ×.
 */
export function AddressCorrectNote({ entered, suggested, onAccept, onKeep, className }: {
  entered: string[];
  suggested: string[];
  onAccept: () => void;
  onKeep: () => void;
  className?: string;
}) {
  const changed = (i: number) => (entered[i] ?? "").trim().toLowerCase() !== (suggested[i] ?? "").trim().toLowerCase();
  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border border-foreground p-3", className)}>
      <p className="text-sm font-medium">We think this address may need a correction</p>
      <div className="grid gap-3 text-xs sm:grid-cols-2">
        <div>
          <p className="mb-0.5 font-semibold">You typed</p>
          <address className="not-italic">
            {entered.map((l, i) => <span key={i} className={cn("block", changed(i) && "font-medium underline decoration-dotted")}>{l}</span>)}
          </address>
        </div>
        <div>
          <p className="mb-0.5 font-semibold">The postal database says</p>
          <address className="not-italic">
            {suggested.map((l, i) => <span key={i} className={cn("block", changed(i) && "font-medium underline decoration-dotted")}>{l}</span>)}
          </address>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {/* Theirs is a real button, not a dismiss. */}
        <button type="button" onClick={onKeep}
          className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-xs font-medium">
          Keep what I typed
        </button>
        <button type="button" onClick={onAccept}
          className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-xs">
          Use the suggestion
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Postal databases are often wrong about new builds and subdivided flats.
      </p>
    </div>
  );
}
