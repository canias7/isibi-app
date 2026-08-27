import { cn } from "@/lib/utils";
/**
 * The frame over a camera view, with a way to type the code instead.
 *
 * TYPING IT IN IS ALWAYS OFFERED. Barcodes are scratched, screens glare, and
 * plenty of phones cannot focus close enough — so a scanner with no manual
 * entry strands people at the exact moment they are standing in front of the
 * thing they need to scan. It is the first control, not a hidden fallback.
 *
 * THE FRAME IS A GUIDE, NOT A REQUIREMENT, and it says so. People spend a long
 * time lining a code up perfectly inside a box that most decoders ignore
 * entirely — a hint costs nothing and stops that.
 *
 * IT NAMES WHAT IT IS LOOKING FOR. "Point at the barcode on the back" is
 * findable; "scan the code" leaves somebody photographing the wrong one of the
 * three on a package.
 *
 * NO SCANNING LASER ANIMATION. It is decoration that implies a line-based
 * decode that is not happening, and it moves constantly for anybody who asked
 * for reduced motion.
 */
export function ScanOverlay({ looking = "the barcode", state = "scanning", onManual, manualLabel = "Type it in instead", children, className }: {
  /** What to point at. */
  looking?: string;
  state?: "scanning" | "found" | "no-camera";
  onManual?: () => void;
  manualLabel?: string;
  /** The camera view. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="scan-overlay" className={cn("space-y-2", className)}>
      <div className="relative overflow-hidden rounded-md border border-border bg-muted">
        {children}
        {state !== "no-camera" && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className={cn("block h-32 w-4/5 rounded-md border-2",
              state === "found" ? "border-foreground" : "border-dashed border-foreground/60")} />
          </div>
        )}
      </div>
      <p role="status" className="text-sm">
        {state === "no-camera"
          ? <span className="font-medium">No camera available.</span>
          : state === "found"
            ? <span className="font-medium">Got it.</span>
            : <>Point at {looking}.<span className="text-muted-foreground"> It does not have to be inside the box.</span></>}
      </p>
      {onManual && (
        <button type="button" onClick={onManual} className="text-sm underline underline-offset-2">
          {manualLabel}
        </button>
      )}
    </div>
  );
}
