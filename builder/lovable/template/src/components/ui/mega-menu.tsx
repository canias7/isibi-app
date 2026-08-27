import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A wide multi-column dropdown from a top-level nav item.
 *
 * IT OPENS ON CLICK, not hover. A hover menu covering a third of the screen
 * fires whenever the pointer crosses the nav on the way somewhere else, and on
 * a touchscreen the first tap opens it while the second follows the link — so
 * the top-level item becomes unreachable. Click is the only interaction that
 * works everywhere.
 *
 * There is a CLOSE DELAY on pointer-leave and none on click-away, so the
 * diagonal path from the trigger to a link in the far column does not close it
 * mid-journey — the classic mega-menu frustration.
 *
 * Below `md` it becomes an ACCORDION in the flow rather than a floating panel.
 * A four-column overlay on a phone is a full-screen takeover with no obvious
 * way out.
 *
 * Escape closes it and returns focus to the trigger; a click outside closes it
 * without moving focus. Those are different because Escape is deliberate and a
 * click already put focus somewhere.
 */
export function MegaMenu({ label, columns, className }: {
  label: React.ReactNode;
  columns: { key: string; title?: React.ReactNode; items: { label: React.ReactNode; href: string; hint?: React.ReactNode }[] }[];
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const wrap = React.useRef<HTMLDivElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <div data-slot="mega-menu"
      ref={wrap}
      className={cn("relative", className)}
      onPointerLeave={() => {
        // A delay, so the diagonal to the far column does not close it.
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setOpen(false), 250);
      }}
      onPointerEnter={() => { if (timer.current) clearTimeout(timer.current); }}
    >
      <button ref={trigger} type="button" onClick={() => setOpen((v) => !v)}
        aria-expanded={open} aria-controls={id}
        className="inline-flex cursor-pointer items-center gap-1 rounded px-2 py-1.5 text-sm font-medium hover:bg-muted">
        {label}
        <ChevronDown aria-hidden className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div id={id}
          className={cn(
            // In the flow on a phone; a floating panel from md up.
            "z-40 mt-1 grid gap-4 rounded-lg border border-border bg-popover p-4",
            "md:absolute md:start-0 md:w-[42rem] md:grid-cols-3 md:shadow-xl")}>
          {columns.map((c) => (
            <div key={c.key}>
              {c.title ? (
                <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{c.title}</p>
              ) : null}
              <ul className="flex flex-col">
                {c.items.map((i) => (
                  <li key={i.href}>
                    <a href={i.href} className="block rounded px-2 py-1.5 text-sm hover:bg-muted">
                      {i.label}
                      {i.hint ? <span className="block text-xs text-muted-foreground">{i.hint}</span> : null}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
