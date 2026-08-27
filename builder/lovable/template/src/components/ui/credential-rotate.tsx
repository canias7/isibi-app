import { Button } from "@/components/ui/button";
import { ClipboardBlocked } from "@/components/ui/clipboard-blocked";
import { cn } from "@/lib/utils";
/**
 * Replacing a key, with the old one still working for a stated overlap.
 *
 * THE OVERLAP IS WHAT MAKES ROTATION POSSIBLE WITHOUT AN OUTAGE. Rotate with no
 * grace period and everything using the old key breaks the instant the new one
 * is minted — so nobody rotates, which is why keys from four years ago are
 * still live. Both keys valid for a window turns it into a routine job.
 *
 * THE NEW KEY IS SHOWN EXACTLY ONCE AND SAYS SO BEFORE IT IS GENERATED. A
 * secret that can be re-read is a secret stored in plaintext somewhere; the
 * warning has to come first, because after the fact it is just bad news.
 *
 * IT USES `ClipboardBlocked`'S SHAPE rather than a copy button that can fail
 * silently — this is the one value in the product where a failed copy is
 * unrecoverable, since the key cannot be shown again.
 *
 * THE OLD KEY'S EXPIRY IS A DATE, not "soon". Somebody has to schedule the work
 * of updating whatever uses it, and "soon" cannot be put in a calendar.
 */
export function CredentialRotate({ createdAt, lastUsed, newSecret, oldExpiresAt, overlapDays = 7, onRotate, busy, className }: {
  /** Free text — "4 years ago". */
  createdAt?: string;
  /** Free text — "10 minutes ago", or absent if never. */
  lastUsed?: string;
  /** Present only immediately after rotating. */
  newSecret?: string;
  /** Free text — "14 August". */
  oldExpiresAt?: string;
  overlapDays?: number;
  onRotate: () => void;
  busy?: boolean;
  className?: string;
}) {
  if (newSecret) {
    return (
      <div data-slot="credential-rotate" className={cn("space-y-2 rounded-md border border-foreground/40 bg-muted/40 p-3", className)}>
        <p className="text-sm font-medium">Your new key — copy it now</p>
        <p className="text-xs text-muted-foreground">
          This is the only time it is shown. If you lose it you will have to rotate again.
        </p>
        <ClipboardBlocked value={newSecret} multiline
          label="Select and copy this — it will not be shown again" />
        {oldExpiresAt && (
          <p className="text-xs text-muted-foreground">
            The old key keeps working until <span className="text-foreground">{oldExpiresAt}</span>. Update anything using it before then.
          </p>
        )}
      </div>
    );
  }
  return (
    <div className={cn("space-y-2 rounded-md border border-border p-3", className)}>
      <p className="text-sm">
        <span className="font-medium">Replace this key</span>
        <span className="block text-xs text-muted-foreground">
          {createdAt ? `Created ${createdAt}.` : ""}
          {lastUsed ? ` Last used ${lastUsed}.` : " Never used."}
        </span>
      </p>
      <p className="text-xs text-muted-foreground">
        The old key keeps working for {overlapDays} days, so nothing breaks while you update it.
        The new key is shown once and cannot be shown again.
      </p>
      <Button type="button" size="sm" onClick={onRotate} disabled={busy}>
        {busy ? "Making a new key…" : "Make a new key"}
      </Button>
    </div>
  );
}
