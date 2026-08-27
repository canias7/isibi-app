import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Text for listeners that is invisible to viewers — and its counterpart.
 *
 * `SrNote` exists because raw `sr-only` spans get misused in two directions:
 * hiding VISIBLE-WORTHY content (a warning everyone needed), and stuffing in
 * paragraphs (a listener gets them as one unpausable run). This wraps the
 * pattern with its rules in the header where the generator reads them: short,
 * supplementary, never the only copy of something important.
 *
 * `Announce` is the polite live region as a component — for state changes that
 * have no visible text of their own. It renders the message into an already-
 * mounted region, because a live region inserted WITH its message is missed by
 * most screen readers; the region must exist first. That ordering bug is
 * invisible in every test that does not run a screen reader, which is why the
 * component owns it.
 *
 * Messages CLEAR after a beat so the same text can be announced twice — a
 * region whose content does not change announces nothing the second time.
 */
export function SrNote({ children }: { children: React.ReactNode }) {
  return <span data-slot="sr-note" className="sr-only">{children}</span>;
}

export function Announce({ message, clearAfter = 3000, assertive, className }: {
  message: React.ReactNode;
  clearAfter?: number;
  assertive?: boolean;
  className?: string;
}) {
  const [shown, setShown] = React.useState<React.ReactNode>("");

  React.useEffect(() => {
    if (!message) return;
    // Into an already-mounted region: inserted-with-message is missed.
    const t = setTimeout(() => setShown(message), 50);
    const clear = setTimeout(() => setShown(""), clearAfter);
    return () => { clearTimeout(t); clearTimeout(clear); };
  }, [message, clearAfter]);

  return (
    <span data-slot="announce" aria-live={assertive ? "assertive" : "polite"} aria-atomic="true"
      className={cn("sr-only", className)}>
      {shown}
    </span>
  );
}
