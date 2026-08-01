import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A term with its meaning one press away.
 *
 * A `<button>`, not a hover tooltip. Hover does not exist on a phone, and a
 * definition only reachable by mouse is a definition most readers never get.
 *
 * THE DEFINITION IS IN THE DOM WHEN OPEN and tied by `aria-controls`, so a
 * screen reader can reach it in the ordinary way — the usual `title` attribute
 * is announced inconsistently and cannot be read at leisure.
 *
 * The term is marked with a dotted underline rather than a colour, so it is
 * distinguishable from ordinary links and survives greyscale. Colour alone would
 * make it indistinguishable from body text for a large minority.
 */
export function GlossaryTerm({ term, definition, className }: {
  term: string; definition: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  return (
    <span className={cn("inline", className)}>
      <button type="button" aria-expanded={open} aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer underline decoration-dotted underline-offset-4">
        {term}
      </button>
      {open && (
        <span id={id} className="mt-1 block rounded-md border border-border bg-muted/40 p-2 text-sm text-muted-foreground">
          {definition}
        </span>
      )}
    </span>
  );
}
