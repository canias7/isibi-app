import * as React from "react";
import { cn } from "@/lib/utils";
/** How far down a long page the reader is. Hidden from assistive tech — it is decoration. */
export function ScrollProgress({ className }: { className?: string }) {
  const [pct, setPct] = React.useState(0);
  React.useEffect(() => {
    const on = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setPct(h > 0 ? Math.min(100, (window.scrollY / h) * 100) : 0);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, []);
  return (
    <div data-slot="scroll-progress" className={cn("fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent", className)} aria-hidden="true">
      <div className="h-full bg-foreground transition-[width] duration-(--dur-1)" style={{ width: pct + "%" }} />
    </div>
  );
}
