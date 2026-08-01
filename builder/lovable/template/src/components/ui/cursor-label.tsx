import { cn } from "@/lib/utils";
/**
 * Somebody else's pointer, with their name attached.
 *
 * THE NAME IS ALWAYS THERE, not on hover. Every implementation that hides the
 * name behind a hover is unusable for its actual purpose: you cannot hover a
 * cursor that is moving, and a room of unlabelled coloured arrows tells you
 * only that you are not alone.
 *
 * MONOCHROME, WITH INITIALS DOING THE WORK OF COLOUR. Presence cursors are the
 * canonical misuse of colour as identity — six people means six hues, at which
 * point two are indistinguishable to a good few readers and all of them are
 * identical in greyscale. The label carries the name; the arrow just points.
 *
 * `pointer-events-none` on the whole thing, or a remote cursor drifting over a
 * button steals the local person's clicks. `aria-hidden`, because a screen
 * reader user cannot see anybody's pointer including their own, and announcing
 * a moving position is noise — `WhoIsHere` is where presence belongs for them.
 *
 * POSITIONED BY THE CALLER via `left`/`top` in CSS pixels: the transport that
 * carries these coordinates is the caller's problem, and this component should
 * work over any of them.
 */
export function CursorLabel({ name, left, top, muted, className }: {
  name: string;
  left: number;
  top: number;
  /** Idle — the person has stopped moving. */
  muted?: boolean;
  className?: string;
}) {
  return (
    <div aria-hidden="true"
      style={{ left, top }}
      className={cn("pointer-events-none absolute z-50 select-none", muted && "opacity-50", className)}>
      <svg viewBox="0 0 12 12" className="size-3 fill-foreground">
        <path d="M0 0 L0 10 L3 7.5 L5 11.5 L7 10.5 L5 6.5 L9 6.5 Z" />
      </svg>
      <span className="mt-0.5 ml-2 inline-block whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background">
        {name}
      </span>
    </div>
  );
}
