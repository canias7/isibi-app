import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Footnotes with working return links.
 *
 * THE BACK-LINK IS WHAT MAKES WEB FOOTNOTES USABLE. On paper the eye jumps
 * back by memory; on a screen the jump to the bottom loses the place, and
 * the ↩ at the end of each note is the way home. Ref links down carry
 * `#fn-<id>`, notes link back to `#fnref-<id>` — both real anchors, so the
 * browser's back button ALSO returns.
 *
 * The reference is a superscript LINK inside brackets' worth of hit area —
 * a bare sup digit is a ~7px tap target. `doc-noteref`/`doc-endnotes`
 * roles, so screen readers announce what kind of link this is.
 *
 * Numbering is the caller's, by id order in the list — the component does
 * not renumber, because prose referring to "note 3" must not silently
 * become note 2.
 */
export function FootnoteRef({ id, n, className }: { id: string; n: number; className?: string }) {
  return (
    <sup data-slot="footnote-ref" className={className}>
      <a href={`#fn-${id}`} id={`fnref-${id}`} role="doc-noteref"
        aria-label={`Footnote ${n}`}
        className="cursor-pointer px-0.5 text-[0.75em] font-medium tabular-nums no-underline hover:underline">
        {n}
      </a>
    </sup>
  );
}

export function FootnoteList({ notes, className }: {
  notes: { id: string; children: React.ReactNode }[];
  className?: string;
}) {
  return (
    <section data-slot="footnote-list" role="doc-endnotes" aria-label="Footnotes"
      className={cn("mt-8 border-t border-border pt-3", className)}>
      <ol className="flex flex-col gap-1.5 ps-5 text-xs text-muted-foreground [list-style:decimal]">
        {notes.map((note) => (
          <li key={note.id} id={`fn-${note.id}`} role="doc-footnote" className="ps-1 leading-relaxed">
            {note.children}{" "}
            <a href={`#fnref-${note.id}`} aria-label="Back to the text"
              className="cursor-pointer no-underline hover:underline">↩</a>
          </li>
        ))}
      </ol>
    </section>
  );
}
