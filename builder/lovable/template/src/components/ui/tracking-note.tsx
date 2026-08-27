import { cn } from "@/lib/utils";
/**
 * What this page is measuring about the visit, said in one line.
 *
 * IT NAMES WHAT IS COLLECTED, not who collects it. "We use Analytics" tells a
 * reader nothing they can act on; "which pages you visit, and roughly where you
 * are" is checkable against what they are willing to give. The vendor's name is
 * available where somebody wants it and is not the headline.
 *
 * "NOT TRACKED" IS WORTH SAYING OUT LOUD. A site that measures nothing gets no
 * credit for it, and the absence of a notice is indistinguishable from a notice
 * nobody wrote. `items` empty renders the honest sentence rather than nothing.
 *
 * IT IS NOT A BANNER AND HAS NO ACCEPT BUTTON. This is the standing statement
 * that belongs in a footer or a settings page — `cookie-banner` is the thing
 * that asks, and conflating them produces a consent request that reappears
 * forever.
 *
 * `honoursDnt` is stated where true, because "we respect Do Not Track" is a
 * claim worth making and one almost nobody can verify from the outside.
 */
export function TrackingNote({ items, vendors, honoursDnt, noneNote = "Nothing about your visit is measured.", className }: {
  /** Plain descriptions — "which pages you visit". */
  items: string[];
  vendors?: string[];
  honoursDnt?: boolean;
  noneNote?: string;
  className?: string;
}) {
  if (!items.length) {
    return <p data-slot="tracking-note" className={cn("text-xs text-muted-foreground", className)}>{noneNote}</p>;
  }
  const list = items.length === 1
    ? items[0]
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      We measure {list}.
      {vendors?.length ? <span> Using {vendors.join(", ")}.</span> : null}
      {honoursDnt ? <span> If your browser asks not to be tracked, we do not.</span> : null}
    </p>
  );
}
