import { PermissionPrompt } from "@/components/ui/permission-prompt";
import { cn } from "@/lib/utils";
/**
 * Asking for the camera, with uploading a photo always offered instead.
 *
 * THE FILE PICKER IS NOT A CONSOLATION PRIZE — it is the answer for most
 * people. Somebody photographing a receipt usually already has the picture, and
 * a flow that treats "take a photo now" as the only path forces them to
 * re-photograph something they have. So the upload route is present in every
 * state, including granted-and-working.
 *
 * IT SAYS THE PICTURE IS NOT LIVE-STREAMED ANYWHERE, because that is the thing
 * people are actually worried about when a site asks for a camera, and no
 * browser prompt says it. Optional, since it must not be claimed where it is
 * untrue.
 *
 * IT ASKS ON A GESTURE, never on mount — `PermissionPrompt` handles the shape,
 * and this fills in the words. Requesting a camera on page load is how a site
 * gets blocked permanently in the first two seconds.
 *
 * `capture` IS NOT SET ON THE FALLBACK INPUT. It forces the camera on a phone,
 * which is precisely what somebody who declined the camera was avoiding.
 */
export function CameraAccess({ state, onAsk, onFile, purpose = "to take a photo", privacyNote, className }: {
  state: "ask" | "asking" | "denied" | "granted" | "unavailable";
  onAsk: () => void;
  /** The upload alternative. */
  onFile?: (file: File) => void;
  purpose?: string;
  /** e.g. "Nothing is streamed anywhere — the photo stays on your device until you send it." */
  privacyNote?: string;
  className?: string;
}) {
  const picker = onFile ? (
    <label className={cn("cursor-pointer text-sm underline underline-offset-2", state === "granted" && "text-muted-foreground")}>
      Choose a photo instead
      <input type="file" accept="image/*" className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </label>
  ) : null;
  if (state === "granted") {
    return picker ? <span className={className}>{picker}</span> : null;
  }
  return (
    <PermissionPrompt className={className} title="Use your camera" state={state} onAsk={onAsk}
      askLabel="Open the camera"
      reason={`We need your camera ${purpose}.${privacyNote ? ` ${privacyNote}` : ""}`}
      fallback={picker} />
  );
}
