import { cn } from "@/lib/utils";
/**
 * An anchor target that does not end up underneath a sticky header.
 *
 * THE CLASSIC BROKEN JUMP: click a table-of-contents link, and the heading lands
 * behind the fixed header — so the reader arrives at what looks like the middle
 * of the previous section and concludes the link is wrong.
 *
 * `scroll-margin-top` is the fix, and it is a CSS property rather than
 * JavaScript, so it works for browser-restored positions and for `:target` as
 * well as for clicks.
 *
 * Wrapping rather than requiring the caller to remember a utility class on every
 * heading is the point — the failure is one somebody forgets on the fifth
 * heading, not one they get wrong deliberately.
 */
export function AnchorOffset({ id, offset = 80, children, className }: {
  id: string;
  /** Height of whatever is sticky above. */
  offset?: number;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div id={id} style={{ scrollMarginTop: offset }} className={cn(className)}>
      {children}
    </div>
  );
}
