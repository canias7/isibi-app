import * as React from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp } from "lucide-react";
import { cn, scrollBehavior } from "@/lib/utils";
/** Back to the top, once there is a top to go back to. */
export function ScrollTop({ after = 600, className }: { after?: number; className?: string }) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const on = () => setShow(window.scrollY > after);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [after]);
  if (!show) return null;
  return (
    <Button size="icon" variant="outline" aria-label="Back to top"
      className={cn("motion-enter fixed bottom-6 right-6 z-40 rounded-full shadow-sm", className)}
      onClick={() => window.scrollTo({ top: 0, behavior: scrollBehavior() })}><ArrowUp /></Button>
  );
}
