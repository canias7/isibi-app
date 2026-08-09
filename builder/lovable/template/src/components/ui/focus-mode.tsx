import * as React from "react";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Everything except the thing being written disappears.
 *
 * Escape leaves, always, and the button stays visible — a full-screen mode
 * with no visible way out is the one people close the tab to escape from.
 *
 * `overflow-hidden` goes on the BODY while it is on, or the page underneath
 * scrolls behind the overlay when the wheel is used.
 */
export function FocusMode({ children, label = "Focus mode", className }: {
  children?: React.ReactNode; label?: string; className?: string;
}) {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    if (!on) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOn(false); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [on]);
  return (
    <div className={cn(on && "fixed inset-0 z-50 overflow-y-auto bg-popover p-6 sm:p-12", className)}>
      <div className={cn(on && "mx-auto max-w-3xl")}>
        <div className="mb-3 flex justify-end">
          <Button type="button" size="sm" variant="ghost" onClick={() => setOn((v) => !v)}>
            {on ? <><Minimize2 className="size-4" />Leave{" "}<span className="text-muted-foreground">(Esc)</span></>
                : <><Maximize2 className="size-4" />{label}</>}
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
