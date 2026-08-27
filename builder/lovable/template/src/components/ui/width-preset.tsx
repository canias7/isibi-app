import { cn } from "@/lib/utils";
/**
 * Narrow, normal or wide — one choice for the page's content width.
 *
 * THE CHOICE IS NAMED, not a pixel number. "Wide" is a decision an owner can
 * make; "1280px" is a question they cannot answer, and a numeric field here
 * produces layouts that are 1147 pixels wide for no reason.
 *
 * NARROW IS MEASURED IN `ch`, because it is for prose and a prose column should
 * hold its measure when the reader changes text size — the same reasoning as
 * `column-reader`. The wider presets are pixel-based, since they are about
 * fitting furniture rather than about reading.
 *
 * "Full" really is full and says so, rather than being a very large number that
 * still leaves a margin on a big screen and looks like a bug.
 */
const WIDTHS = {
  narrow: "65ch",
  normal: "1024px",
  wide: "1280px",
  full: "100%",
} as const;

export type WidthKey = keyof typeof WIDTHS;

export function WidthPreset({ width = "normal", children, className }: {
  width?: WidthKey;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="width-preset" style={{ maxWidth: WIDTHS[width] }} className={cn("mx-auto w-full", className)}>
      {children}
    </div>
  );
}
