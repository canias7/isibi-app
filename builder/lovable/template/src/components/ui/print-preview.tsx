import * as React from "react";
import { Printer } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The print button, and the rules that make a page print properly.
 *
 * `PrintOnly` AND `NoPrint` ARE THE REAL CONTENT HERE. A page printed without
 * them wastes the first sheet on a navigation bar and a cookie banner, and
 * loses every URL behind a link — so `PrintOnly` puts the address of the page
 * on the paper and `NoPrint` takes the furniture off it.
 *
 * `PageBreak` uses `break-inside: avoid` on blocks rather than forcing breaks
 * everywhere: a table row split across two sheets is the thing people actually
 * complain about, and it is one property.
 *
 * IT DOES NOT OPEN A CUSTOM PREVIEW. The browser has one, it is better than any
 * reimplementation, and a fake preview showing a different layout from the real
 * print output is worse than none. This triggers the real one.
 *
 * `window.print()` BLOCKS on most browsers until the dialog closes, so anything
 * that must happen first — expanding collapsed sections, loading images — has
 * to be awaited by the caller before the button is pressed, not after.
 */
export function PrintButton({ onBeforePrint, label = "Print", className }: {
  onBeforePrint?: () => void | Promise<void>;
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <button type="button" disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          // Anything that must be on the paper has to finish first: print() blocks.
          await onBeforePrint?.();
          window.print();
        } finally { setBusy(false); }
      }}
      className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:pointer-events-none disabled:opacity-60", className)}>
      <Printer aria-hidden className="size-3.5" />
      {busy ? "Preparing…" : label}
    </button>
  );
}

/** Hidden on screen, printed on paper — for the URL, a footer, a signature line. */
export function PrintOnly({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("hidden print:block", className)}>{children}</div>;
}

/** On screen only — navigation, banners, buttons. */
export function NoPrint({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("print:hidden", className)}>{children}</div>;
}

/** Keeps a block whole across a page break. */
export function PageBreak({ children, before, className }: {
  children: React.ReactNode;
  before?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(before ? "break-before-page" : "break-inside-avoid", className)}>{children}</div>
  );
}
