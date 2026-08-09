import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * A booking bar that follows on a phone.
 *
 * Appears only after the reader has scrolled past the real one, so it does not
 * cover content nobody has read yet, and only below the `md` breakpoint — on a
 * desktop the header is already in view.
 */
export function StickyCta({ label, price, onClick, href, after = 400, className }: {
  label: string; price?: string; onClick?: () => void; href?: string;
  after?: number; className?: string;
}) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const on = () => setShow(window.scrollY > after);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [after]);
  if (!show) return null;
  return (
    <div className={cn("motion-enter fixed inset-x-0 bottom-0 z-40 border-t bg-popover/95 p-3 backdrop-blur md:hidden", className)}>
      <div className="flex items-center gap-3">
        {price && <span className="text-sm font-medium tabular-nums">{price}</span>}
        <Button className="ml-auto flex-1" asChild={!!href} onClick={onClick}>
          {href ? <a href={href}>{label}</a> : <span>{label}</span>}
        </Button>
      </div>
    </div>
  );
}
