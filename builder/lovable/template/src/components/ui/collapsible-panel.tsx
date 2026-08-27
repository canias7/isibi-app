import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A titled section that folds away, remembering whether it was open.
 *
 * THE STATE PERSISTS when given a `storageKey`. Somebody who collapses a section
 * they never use should not find it open again on every visit — that is the
 * difference between a control and a decoration. localStorage, wrapped in
 * try/catch for Safari private mode.
 *
 * A real `<button>` with `aria-expanded` and `aria-controls`, and the heading
 * level is the CALLER'S. A component that hard-codes `<h3>` breaks the document
 * outline wherever it is used at a different depth, which is exactly what a
 * screen reader navigates by.
 *
 * The content is unmounted when closed rather than hidden, so nothing inside it
 * is reachable by Tab while invisible.
 */
export function CollapsiblePanel({ title, children, defaultOpen = true, storageKey, as: Tag = "h3", className }: {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** Remember the open state under this key. */
  storageKey?: string;
  as?: "h2" | "h3" | "h4";
  className?: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const id = React.useId();
  React.useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) setOpen(saved === "1");
    } catch { /* private mode */ }
  }, [storageKey]);
  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (storageKey) { try { localStorage.setItem(storageKey, next ? "1" : "0"); } catch { /* as above */ } }
      return next;
    });
  };
  return (
    <section data-slot="collapsible-panel" className={cn("rounded-md border border-border", className)}>
      <Tag className="m-0">
        <button type="button" aria-expanded={open} aria-controls={id} onClick={toggle}
          className="flex w-full cursor-pointer items-center gap-2 p-3 text-start text-sm font-medium">
          <ChevronDown aria-hidden className={cn("size-4 shrink-0 transition-transform", !open && "-rotate-90")} />
          {title}
        </button>
      </Tag>
      {open && <div id={id} className="border-t border-border p-3">{children}</div>}
    </section>
  );
}
