import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A row you swipe sideways to reveal actions.
 *
 * THE ACTIONS ARE ALSO REAL BUTTONS, rendered off-screen rather than
 * conjured on swipe — so they are in the tab order and reachable without a
 * touchscreen. A swipe-only action is invisible and unusable to everyone on
 * a desktop, which is how "delete" ends up with no other route to it.
 *
 * Pointer events with capture, so one implementation serves finger, stylus
 * and mouse. It snaps open or shut past a threshold rather than resting
 * anywhere, because a row left half-open looks broken.
 */
export function SwipeableRow({ children, actions, actionWidth = 88, className }: {
  children?: React.ReactNode;
  actions: { label: string; onAction: () => void; destructive?: boolean }[];
  actionWidth?: number; className?: string;
}) {
  const [dx, setDx] = React.useState(0);
  const start = React.useRef<{ x: number; base: number } | null>(null);
  const width = actions.length * actionWidth;
  return (
    <div className={cn("relative overflow-hidden border-b border-border last:border-0", className)}>
      <div className="absolute inset-y-0 end-0 flex">
        {actions.map((a) => (
          <button key={a.label} type="button" onClick={() => { a.onAction(); setDx(0); }}
            style={{ width: actionWidth }}
            className={cn("cursor-pointer text-sm font-medium",
              a.destructive ? "bg-destructive text-destructive-foreground" : "bg-muted")}>
            {a.label}
          </button>
        ))}
      </div>
      <div style={{ transform: `translateX(${-dx}px)`, touchAction: "pan-y" }}
        className="relative bg-background transition-transform"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); start.current = { x: e.clientX, base: dx }; }}
        onPointerMove={(e) => {
          if (!start.current) return;
          setDx(Math.max(0, Math.min(width, start.current.base + (start.current.x - e.clientX))));
        }}
        onPointerUp={() => { setDx((d) => (d > width / 2 ? width : 0)); start.current = null; }}>
        {children}
      </div>
    </div>
  );
}
