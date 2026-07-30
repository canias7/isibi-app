import { cn } from "@/lib/utils";
/** A bar pinned to the bottom. On a phone this is where the real action goes. */
export function StickyBar({ position = "bottom", className, children }: {
  position?: "top" | "bottom"; className?: string; children?: React.ReactNode;
}) {
  return (
    <div className={cn("sticky z-30 border-border bg-background/90 px-4 py-3 backdrop-blur",
      position === "bottom" ? "bottom-0 border-t" : "top-0 border-b", className)}>
      {children}
    </div>
  );
}
