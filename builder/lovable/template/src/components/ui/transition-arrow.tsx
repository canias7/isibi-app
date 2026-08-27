import * as React from "react";
import { ArrowRight, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Confirmed → Cancelled" — one allowed move between states.
 *
 * A FORBIDDEN TRANSITION IS SHOWN, struck through, rather than hidden. The
 * question somebody has at a stuck record is "why can I not move it", and a
 * missing arrow answers nothing — a crossed one with a reason answers it
 * completely.
 *
 * THE ACTION'S NAME IS NOT THE TARGET STATE. "Cancel" moves a booking to
 * "Cancelled" and those are different words; labelling the button with the
 * state produces "Cancelled" as an imperative, which reads as already done.
 *
 * A transition that needs a REASON or a confirmation says so before it is
 * pressed, not after. Discovering a required note in a dialog after committing
 * to the action is where people abandon halfway.
 *
 * The arrow is `aria-hidden` and the accessible name is a sentence — "Move from
 * Confirmed to Cancelled" — because an arrow glyph is read as "rightwards
 * arrow" or skipped.
 */
export function TransitionArrow({ from, to, action, allowed = true, reason, needsNote, onMove, className }: {
  from: React.ReactNode;
  to: React.ReactNode;
  action?: string;
  allowed?: boolean;
  reason?: React.ReactNode;
  needsNote?: boolean;
  onMove?: () => void;
  className?: string;
}) {
  const name = `Move from ${typeof from === "string" ? from : "here"} to ${typeof to === "string" ? to : "there"}`;
  return (
    <div data-slot="transition-arrow" className={cn("flex flex-wrap items-center gap-2 text-sm", className)}>
      <span className={cn(!allowed && "text-muted-foreground")}>{from}</span>
      {allowed
        ? <ArrowRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        : <Ban aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />}
      <span className={cn(!allowed && "text-muted-foreground line-through")}>{to}</span>
      {allowed && onMove ? (
        <button type="button" onClick={onMove} aria-label={name}
          className="cursor-pointer rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted">
          {action ?? "Move"}
          {needsNote ? <span className="ms-1 font-normal text-muted-foreground">(needs a note)</span> : null}
        </button>
      ) : null}
      {/* The answer to "why can I not move it". */}
      {!allowed && reason ? <span className="text-xs text-muted-foreground">{reason}</span> : null}
    </div>
  );
}
