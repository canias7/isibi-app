import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A one-line summary that opens into the detail.
 *
 * Built on native `<details>`/`<summary>`, which gives keyboard operation,
 * screen-reader semantics and find-in-page opening the section for free —
 * things a div-and-state version has to reimplement and usually gets wrong.
 *
 * `open` and `onToggle` make it controllable WITHOUT losing any of that, which
 * is the usual reason people abandon `<details>` and hand-roll one.
 *
 * The marker is replaced rather than hidden with `list-style: none` alone,
 * because Safari needs `::-webkit-details-marker` too — a rotating chevron plus
 * a stray triangle is the commonest visual bug on this element.
 */
export function SummaryToggle({ summary, children, open, onToggle, className }: {
  summary: React.ReactNode;
  children: React.ReactNode;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  className?: string;
}) {
  return (
    <details
      {...(open === undefined ? {} : { open })}
      onToggle={(e) => onToggle?.((e.currentTarget as HTMLDetailsElement).open)}
      className={cn("group rounded-md border border-border", className)}>
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-90" />
        {summary}
      </summary>
      <div className="border-t border-border p-3 text-sm text-muted-foreground">{children}</div>
    </details>
  );
}
