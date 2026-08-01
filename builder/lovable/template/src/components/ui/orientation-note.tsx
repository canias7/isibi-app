import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
/**
 * "Turn your phone sideways for this table" — a hint, never a wall.
 *
 * IT DOES NOT BLOCK THE CONTENT. The version that ships everywhere replaces the
 * page with "please rotate your device", which is unusable on a tablet in a
 * stand, on a phone with rotation lock on, and on anything that cannot rotate
 * at all. This is a line above the content, and the content stays reachable.
 *
 * IT ONLY APPEARS WHERE ROTATING IS POSSIBLE — coarse pointer and a portrait
 * viewport. Telling somebody at a desk to turn their monitor is the failure
 * mode of every orientation check that reads the aspect ratio alone.
 *
 * IT LISTENS RATHER THAN CHECKING ONCE, so it disappears the moment the phone
 * is turned. A hint that persists after the reader has done what it asked is
 * how people learn to ignore hints.
 *
 * SSR-SAFE: it starts hidden and only ever appears from an effect, so there is
 * no server/client mismatch and no flash of a message on a desktop.
 */
export function OrientationNote({ message = "Turn your phone sideways to see this properly", className }: {
  message?: string;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const portrait = window.matchMedia("(orientation: portrait)");
    const coarse = window.matchMedia("(pointer: coarse)");
    const update = () => setShow(portrait.matches && coarse.matches);
    update();
    portrait.addEventListener("change", update);
    return () => portrait.removeEventListener("change", update);
  }, []);
  if (!show) return null;
  return (
    <p className={cn("rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground", className)}>
      {message}
    </p>
  );
}
