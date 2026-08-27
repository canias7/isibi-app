import * as React from "react";
import { PictureInPicture2 } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Pop the video out into a floating window.
 *
 * IT HIDES ITSELF WHERE THE API DOES NOT EXIST, rather than rendering a button
 * that does nothing. Picture-in-picture is unsupported on several mobile
 * browsers, and a dead control is worse than an absent one — people press it
 * repeatedly and conclude the player is broken.
 *
 * The check runs in an effect rather than at module scope, so server and first
 * client render agree and nothing flickers on hydration.
 *
 * THE REQUEST IS AWAITED AND ITS FAILURE SWALLOWED. The browser rejects it when
 * the gesture is not trusted or the element is not ready, and an unhandled
 * rejection in a click handler is a console error the reader cannot act on.
 */
export function PictureInPicture({ videoRef, className }: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  className?: string;
}) {
  const [supported, setSupported] = React.useState(false);
  React.useEffect(() => {
    setSupported(typeof document !== "undefined" && "pictureInPictureEnabled" in document
      && (document as Document).pictureInPictureEnabled);
  }, []);
  if (!supported) return null;
  return (
    <button data-slot="picture-in-picture" type="button" aria-label="Pop out into a floating window"
      onClick={async () => {
        const el = videoRef.current;
        if (!el) return;
        try {
          if (document.pictureInPictureElement) await document.exitPictureInPicture();
          else await el.requestPictureInPicture();
        } catch { /* refused — not a trusted gesture, or not ready */ }
      }}
      className={cn("grid size-8 cursor-pointer place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground", className)}>
      <PictureInPicture2 aria-hidden className="size-4" />
    </button>
  );
}
