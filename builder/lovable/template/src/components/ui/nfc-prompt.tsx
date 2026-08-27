import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * "Hold your phone near the tag" — with the alternative, because NFC often
 * cannot work.
 *
 * WEB NFC IS CHROME ON ANDROID AND NOWHERE ELSE. That is most of the market
 * excluded, so the fallback is not an edge case — it is the majority path, and
 * a component that treats it as a degraded mode gets the emphasis backwards.
 *
 * IT SAYS WHERE THE ANTENNA IS. "Hold your phone near it" fails because the NFC
 * coil is at the top on some phones and the middle on others, and somebody
 * waving the bottom edge concludes the tag is broken.
 *
 * A FAILED READ IS USUALLY A POSITION PROBLEM, and the message says so rather
 * than reporting an error. "Try moving it slightly" resolves most of them.
 *
 * IT NEVER AUTO-STARTS. A scan begun without a gesture is refused by the
 * browser anyway, and a prompt that appears to be listening when it is not is
 * worse than one that waits to be pressed.
 */
export function NfcPrompt({ state, onScan, onManual, manualLabel = "Type the code instead", className }: {
  state: "idle" | "scanning" | "read" | "failed" | "unsupported";
  onScan: () => void;
  onManual?: () => void;
  manualLabel?: string;
  className?: string;
}) {
  return (
    <div data-slot="nfc-prompt" className={cn("space-y-2", className)}>
      {state === "unsupported" ? (
        <p className="text-sm">
          <span className="font-medium">Your browser cannot read tags.</span>
          <span className="block text-xs text-muted-foreground">
            Only some phones and browsers can. Nothing is wrong with the tag.
          </span>
        </p>
      ) : (
        <>
          <p role="status" className="text-sm">
            {state === "scanning" && (
              <>
                <span className="font-medium">Hold the tag against your phone</span>
                <span className="block text-xs text-muted-foreground">
                  The reader is usually near the top of the back — try there first.
                </span>
              </>
            )}
            {state === "read" && <span className="font-medium">Read it.</span>}
            {state === "failed" && (
              <>
                <span className="font-medium">Nothing read yet.</span>
                <span className="block text-xs text-muted-foreground">
                  Move the phone slightly — it is nearly always a matter of position.
                </span>
              </>
            )}
            {state === "idle" && <span className="text-muted-foreground">Ready when you are.</span>}
          </p>
          {state !== "read" && (
            <Button type="button" size="sm" onClick={onScan} disabled={state === "scanning"}>
              {state === "scanning" ? "Waiting for a tag…" : state === "failed" ? "Try again" : "Read a tag"}
            </Button>
          )}
        </>
      )}
      {onManual && (
        <button type="button" onClick={onManual} className="block text-sm underline underline-offset-2">
          {manualLabel}
        </button>
      )}
    </div>
  );
}
