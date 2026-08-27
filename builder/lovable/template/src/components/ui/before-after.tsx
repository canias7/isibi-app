import * as React from "react";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";

/**
 * Two pictures, one wipe between them.
 *
 * Driven by a range input rather than pointer maths, which makes it keyboard
 * operable and screen-reader announceable for free — the usual drag-handle
 * version is neither.
 */
export function BeforeAfter({
  before, after, beforeLabel = "Before", afterLabel = "After", ratio = "4/3", className,
}: {
  before?: string | null;
  after?: string | null;
  beforeLabel?: string;
  afterLabel?: string;
  ratio?: string;
  className?: string;
}) {
  const [pos, setPos] = React.useState(50);
  return (
    <div data-slot="before-after" className={cn("flex flex-col gap-2", className)}>
      <div className="relative overflow-hidden rounded-lg" style={{ aspectRatio: ratio }}>
        <SafeImage src={after} alt={afterLabel} ratio={ratio} className="absolute inset-0 size-full rounded-none" />
        <div className="absolute inset-0 overflow-hidden" style={{ width: pos + "%" }}>
          <SafeImage src={before} alt={beforeLabel} ratio={ratio} className="size-full rounded-none" />
        </div>
        <div className="pointer-events-none absolute inset-y-0 w-px bg-background" style={{ left: pos + "%" }} />
      </div>
      <input type="range" min={0} max={100} value={pos} aria-label={`${beforeLabel} to ${afterLabel}`}
        onChange={(e) => setPos(Number(e.target.value))} className="w-full cursor-pointer" />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{beforeLabel}</span><span>{afterLabel}</span>
      </div>
    </div>
  );
}
