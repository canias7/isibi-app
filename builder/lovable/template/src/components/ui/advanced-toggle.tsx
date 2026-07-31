import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Show advanced settings" — a disclosure, remembered.
 *
 * HIDING IS NOT PROTECTION. Advanced settings are the RARELY-WANTED ones,
 * not the dangerous ones — anything destructive needs its own confirm
 * (reset-defaults) wherever it lives, because "it was behind Advanced" has
 * never once stopped the person who found it. This component only manages
 * attention.
 *
 * THE STATE IS REMEMBERED (localStorage, try/catch like every stored
 * preference here). Somebody who opened Advanced is somebody who uses
 * advanced settings; making them re-open it every visit teaches them to
 * resent the fold.
 *
 * The label says what it reveals and the chevron shows state; contents are
 * real children, mounted only when open — an aria-expanded button, not a
 * styled div.
 */
export function AdvancedToggle({ label = "Advanced", storageKey = "advanced-open", children, className }: {
  label?: React.ReactNode;
  storageKey?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    try { if (localStorage.getItem(storageKey) === "1") setOpen(true); } catch { /* private mode */ }
  }, [storageKey]);
  const toggle = () => {
    setOpen((v) => {
      try { localStorage.setItem(storageKey, v ? "0" : "1"); } catch { /* private mode */ }
      return !v;
    });
  };
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <button type="button" onClick={toggle} aria-expanded={open}
        className="flex cursor-pointer items-center gap-1 self-start text-sm font-medium hover:underline">
        <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
        {label}
      </button>
      {open ? <div className="pl-5">{children}</div> : null}
    </div>
  );
}
