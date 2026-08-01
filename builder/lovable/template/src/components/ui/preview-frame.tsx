import { cn } from "@/lib/utils";
/**
 * A themed preview at a chosen device width, with the real width printed.
 *
 * THE WIDTH IS A NUMBER ON SCREEN. "Mobile" means different things to different
 * people and to different devices; 375 is checkable against a design and
 * against the breakpoints in the stylesheet, which is what somebody is actually
 * comparing.
 *
 * IT SCALES DOWN RATHER THAN SCROLLING when the frame is wider than its
 * container, so a 1280px preview inside a 600px panel is visible whole. A
 * horizontally scrolling preview hides the right-hand half, which is where
 * layout breaks.
 *
 * IT SCALES WITH `zoom`, NOT `transform: scale`, and that is the whole
 * difference between working and not. A transform does not change layout, so
 * the container keeps the UNSCALED height and the preview is clipped at the
 * bottom — measured, with the last line of a card cut off. `zoom` is a layout
 * property, so the box shrinks with its contents and no height has to be
 * guessed or measured. It is in every current browser (Firefox since 126).
 *
 * IT IS A SCALED `<div>`, NOT AN IFRAME. An iframe needs a URL and a round
 * trip, and the point of a theme preview is to reflect unsaved values that
 * exist only in this page's state. `iframe-fallback` is the component for when
 * an iframe genuinely is needed.
 *
 * THE SCALE IS STATED when it is not 1, because judging spacing on a preview
 * shrunk to 60% without knowing it is how a design gets approved and then looks
 * wrong.
 */
export function PreviewFrame({ width = 375, available, children, label, className }: {
  /** Device width in CSS pixels. */
  width?: number;
  /** How much room the frame has. Omit to render at full size. */
  available?: number;
  children: React.ReactNode;
  label?: string;
  className?: string;
}) {
  const scale = available && available < width ? available / width : 1;
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs text-muted-foreground">
        {label ? `${label} · ` : ""}
        <span className="tabular-nums">{width}px</span> wide
        {scale < 1 && <span> · shown at {Math.round(scale * 100)}%</span>}
      </p>
      <div className="overflow-hidden rounded-md border border-border">
        <div style={{ width, zoom: scale }}>{children}</div>
      </div>
    </div>
  );
}
