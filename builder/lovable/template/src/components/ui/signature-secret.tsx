import { ClipboardBlocked } from "@/components/ui/clipboard-blocked";
import { cn } from "@/lib/utils";
/**
 * The signing secret, with the reason it exists stated next to it.
 *
 * IT SAYS WHAT HAPPENS IF YOU DO NOT CHECK THE SIGNATURE. A webhook URL is
 * guessable or discoverable, so an unverified endpoint accepts events from
 * anybody who finds it — which for "payment succeeded" is somebody granting
 * themselves goods. Most integrators skip verification because nothing ever
 * told them that.
 *
 * THE SECRET IS MASKED BY DEFAULT and revealing it is a deliberate act. This
 * panel is open on shared screens far more often than it is read, and a value
 * that is visible whenever the page is has effectively no protection.
 *
 * THE HEADER NAME AND ALGORITHM ARE PRINTED, because they are what somebody
 * needs to write the check and are otherwise buried in documentation.
 *
 * REVEALING USES `ClipboardBlocked`'S FIELD, so copying works even where the
 * clipboard API is refused — the same reasoning as `credential-rotate`.
 */
export function SignatureSecret({ secret, revealed, onReveal, header = "X-Signature", algorithm = "HMAC-SHA256", className }: {
  secret: string;
  revealed?: boolean;
  onReveal?: () => void;
  header?: string;
  algorithm?: string;
  className?: string;
}) {
  return (
    <div data-slot="signature-secret" className={cn("space-y-2 rounded-md border border-border p-3", className)}>
      <p className="text-sm font-medium">Signing secret</p>
      <p className="text-xs text-muted-foreground">
        Every request carries a <code className="font-mono">{header}</code> header, signed with {algorithm}.
        Check it before you trust the body — anyone who learns your URL can post to it otherwise.
      </p>
      {revealed ? (
        <ClipboardBlocked value={secret} label="Select and copy your signing secret" />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <code className="font-mono text-xs text-muted-foreground">••••••••••••••••</code>
          {onReveal && (
            <button type="button" onClick={onReveal} className="text-xs underline underline-offset-2">
              Show it
            </button>
          )}
        </div>
      )}
    </div>
  );
}
