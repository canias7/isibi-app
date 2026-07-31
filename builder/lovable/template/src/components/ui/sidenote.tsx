import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A note AT the point of reference, expanded in place.
 *
 * NOT A MARGIN NOTE, DELIBERATELY. The Tufte margin needs the page to have
 * reserved a margin — a component cannot demand one, and a float pushed
 * into space that is not there overlaps whatever is (rendered exactly that
 * failure in the first draft of this kit's coach-mark work). So the note
 * expands INLINE when its marker is pressed: works at every width, inside
 * any container, and the reader who does not care never sees it.
 *
 * HOW IT DIFFERS FROM footnote: a footnote collects at the END (citations,
 * sources — things a completionist reads in a batch); a sidenote is an
 * aside that only makes sense HERE. If the note would survive being moved
 * to the bottom, it is a footnote.
 *
 * The marker is a real button with aria-expanded; the note is plain text
 * in the flow, so it wraps, selects and prints like prose.
 */
export function Sidenote({ label = "*", children, className }: {
  label?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className={cn("cursor-pointer align-super text-[0.75em] font-medium underline decoration-dotted underline-offset-2",
          open && "bg-foreground px-0.5 text-background no-underline", className)}>
        {label}
      </button>
      {open ? (
        <span className="mx-0.5 rounded-sm bg-muted px-1.5 py-0.5 text-[0.9em] text-muted-foreground">
          {children}
        </span>
      ) : null}
    </>
  );
}
