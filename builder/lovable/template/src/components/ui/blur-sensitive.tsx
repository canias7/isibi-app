import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A blur veil over media, revealed by choice.
 *
 * THIS IS A VIEWING VEIL, NOT ACCESS CONTROL, and the header is the contract:
 * the bytes are already on the visitor's machine — anything truly private
 * must never have been sent. What this buys is not showing a thing to a
 * person (or the person next to them) who did not choose to see it.
 *
 * THE BLUR IS HEAVY AND SCALED. At small radii text under a blur stays
 * readable, and the sharp edge of the frame leaks a border of unblurred
 * pixels — blur(24px) with a 1.08 scale closes both. Measured by looking,
 * which is the only test a veil has.
 *
 * THE HIDDEN STATE IS HIDDEN FROM ASSISTIVE TECH TOO (`aria-hidden` until
 * revealed) — equal information: a screen reader user gets the label and the
 * same choice, not the content read aloud past a veil sighted users can't
 * see through.
 *
 * Re-hideable, same reason as content-warning: screens get shared.
 */
export function BlurSensitive({ label = "Sensitive image", children, className }: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [shown, setShown] = React.useState(false);
  return (
    <div className={cn("relative overflow-hidden rounded-lg", className)}>
      <div aria-hidden={!shown}
        className={cn("transition-[filter,transform]", !shown && "scale-[1.08] blur-2xl")}>
        {children}
      </div>
      {shown ? (
        <button type="button" onClick={() => setShown(false)}
          className="absolute end-2 top-2 cursor-pointer rounded-md border border-border bg-background/90 px-2 py-0.5 text-xs shadow-sm">
          Hide
        </button>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <p className="rounded-md bg-background/80 px-2 py-0.5 text-xs font-medium">{label}</p>
          <button type="button" onClick={() => setShown(true)}
            className="cursor-pointer rounded-md border border-border bg-popover px-3 py-1 text-xs font-medium shadow-sm hover:bg-muted">
            Show
          </button>
        </div>
      )}
    </div>
  );
}
