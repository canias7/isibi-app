import * as React from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The state a section shows when its data failed to load.
 *
 * RETRY RETRIES THE SECTION, NOT THE PAGE. A whole-page reload throws away
 * everything else that loaded fine plus anything typed; the button calls the
 * caller's refetch and says so. This is the error half of the `data-list`
 * contract, standalone for anything that is not a list.
 *
 * IT SAYS WHETHER THE PROBLEM IS THEIRS OR OURS. "Check your connection" and
 * "something broke on our side" have different next steps, and `navigator.onLine`
 * — while not proof — is right often enough to be worth a different first
 * sentence. Offline is phrased as advice, not certainty.
 *
 * RETRYING DISABLES THE BUTTON and says "trying…", because a failed fetch
 * that fails again in 300ms otherwise looks like the button did nothing.
 *
 * `role="alert"` once, on arrival. The retry state changes are `aria-live`
 * through the button's own label.
 */
export function LoadError({ what = "this", onRetry, retrying, detail, className }: {
  what?: React.ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  detail?: React.ReactNode;
  className?: string;
}) {
  const [offline, setOffline] = React.useState(false);
  React.useEffect(() => {
    setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  return (
    <div data-slot="load-error" role="alert" className={cn("flex flex-col items-center gap-2 rounded-md border border-border py-8 text-center", className)}>
      <p className="text-sm font-medium">Could not load {what}</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        {offline
          ? "You look to be offline — check the connection and try again."
          : "Something went wrong at our end. Your data is fine; loading it is what failed."}
        {detail ? <span className="block">{detail}</span> : null}
      </p>
      {onRetry ? (
        <button type="button" onClick={onRetry} disabled={retrying}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:pointer-events-none disabled:opacity-60">
          <RefreshCw aria-hidden className={cn("size-3.5", retrying && "motion-safe:animate-spin")} />
          {retrying ? "Trying…" : "Try again"}
        </button>
      ) : null}
    </div>
  );
}
