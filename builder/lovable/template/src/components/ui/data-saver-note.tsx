import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
/**
 * "We are showing you the light version" — said when data saving is on.
 *
 * THE READER ASKED FOR THIS, so it is a note and not an apology. Somebody with
 * `Save-Data` on, or on a 2G connection, has told their browser to economise;
 * silently degrading the page without saying so makes them think the site is
 * broken, and the version with a nag to "turn off data saver" ignores why they
 * turned it on.
 *
 * THE OVERRIDE IS ALWAYS THERE, per page. "Load the images anyway" is a
 * one-visit decision somebody makes for the one page where the pictures are the
 * point, and it does not require finding a browser setting.
 *
 * IT READS THE CONNECTION RATHER THAN GUESSING FROM SPEED. `navigator.connection`
 * carries the reader's own `saveData` flag and effective type — measuring
 * throughput to infer it is both slower and wrong on a fast connection somebody
 * is paying per megabyte for.
 *
 * THE API IS ABSENT IN SAFARI AND FIREFOX, so this renders nothing there. That
 * is correct: no signal means no claim.
 */
type Conn = { saveData?: boolean; effectiveType?: string };

export function DataSaverNote({ what = "images", onLoadAnyway, className }: {
  /** What is being held back. */
  what?: string;
  onLoadAnyway?: () => void;
  className?: string;
}) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const c = (navigator as Navigator & { connection?: Conn }).connection;
    if (!c) return;
    const update = () => setOn(Boolean(c.saveData) || c.effectiveType === "slow-2g" || c.effectiveType === "2g");
    update();
    const target = c as unknown as EventTarget;
    target.addEventListener?.("change", update);
    return () => target.removeEventListener?.("change", update);
  }, []);
  if (!on) return null;
  return (
    <p data-slot="data-saver-note" className={cn("flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground", className)}>
      <span>Your browser is saving data, so we are not loading {what}.</span>
      {onLoadAnyway && (
        <button type="button" onClick={onLoadAnyway} className="underline underline-offset-2">
          Load them anyway
        </button>
      )}
    </p>
  );
}
