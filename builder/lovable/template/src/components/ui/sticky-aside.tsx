import { cn } from "@/lib/utils";
/** A panel that follows down the page — a booking box beside a long description. */
export function StickyAside({ top = "1.5rem", className, children }: {
  top?: string; className?: string; children?: React.ReactNode;
}) {
  return (
    <div data-slot="sticky-aside" className={cn("md:sticky md:h-fit", className)} style={{ top }}>
      {children}
    </div>
  );
}
