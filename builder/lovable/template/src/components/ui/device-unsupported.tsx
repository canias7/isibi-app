import { cn } from "@/lib/utils";
/**
 * "Your browser cannot do this" — with what it needs, and what still works.
 *
 * IT NAMES THE MISSING CAPABILITY, never the browser. Sniffing the user agent
 * to say "please use Chrome" is wrong the moment a browser gains the feature,
 * hostile to anybody who cannot switch, and usually wrong about the actual
 * cause anyway. "This needs a camera" is a fact the reader can check.
 *
 * "IT WORKS EVERYWHERE ELSE" IS THE MOST IMPORTANT LINE, because the commonest
 * cause of a missing web API is not an old browser — it is an insecure context.
 * A site opened over plain HTTP loses camera, clipboard and geolocation at
 * once, which looks like a broken feature and is a URL problem.
 *
 * THE ALTERNATIVE IS PART OF THE COMPONENT. A message that only says no is a
 * dead end; almost every capability here has a manual route — upload instead of
 * capture, type instead of scan — and this is where it belongs.
 *
 * `role="note"`, because it is a standing fact rather than a live update, and
 * it does not block whatever else the page offers.
 */
export function DeviceUnsupported({ feature, needs, insecureContext, alternative, className }: {
  /** What cannot be done — "scanning a barcode". */
  feature: string;
  /** What it requires — "a camera". */
  needs?: string;
  /** True when the page is not on https, which removes several APIs at once. */
  insecureContext?: boolean;
  alternative?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="device-unsupported" role="note" className={cn("space-y-1.5 rounded-md border border-border bg-muted/40 p-3", className)}>
      <p className="text-sm">
        <span className="font-medium">{feature} is not available here.</span>
        {needs && <span className="text-muted-foreground"> It needs {needs}.</span>}
      </p>
      {insecureContext && (
        <p className="text-xs text-muted-foreground">
          This page is not on a secure connection, which is what switches the feature off.
        </p>
      )}
      {alternative && <div className="text-sm">{alternative}</div>}
    </div>
  );
}
