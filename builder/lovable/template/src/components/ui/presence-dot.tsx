import { cn } from "@/lib/utils";
/**
 * Whether a PERSON is around — online, away, busy, offline.
 *
 * Deliberately separate from `StatusDot`, which is about a system being up.
 * They look alike and mean different things, and one component covering both
 * ends up with a person who is "Failed".
 *
 * Fill carries the state as well as colour — solid, ring, ring-with-bar,
 * hollow — so it survives greyscale and colour blindness, and the word is
 * always available even when it is not shown.
 */
export function PresenceDot({ state = "offline", label, showLabel = true, ring, className }: {
  state?: "online" | "away" | "busy" | "offline";
  label?: string; showLabel?: boolean; ring?: boolean; className?: string;
}) {
  const text = label ?? { online: "Online", away: "Away", busy: "Busy", offline: "Offline" }[state];
  const dot = {
    online: "bg-success",
    away: "bg-background ring-2 ring-inset ring-warning",
    busy: "bg-destructive",
    offline: "bg-background ring-2 ring-inset ring-muted-foreground/50",
  }[state];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      <span className={cn("size-2.5 shrink-0 rounded-full", dot, ring && "ring-2 ring-background")} aria-hidden="true" />
      {showLabel ? <span className="text-muted-foreground">{text}</span> : <span className="sr-only">{text}</span>}
      {state === "busy" && <span className="sr-only"> — do not disturb</span>}
    </span>
  );
}
