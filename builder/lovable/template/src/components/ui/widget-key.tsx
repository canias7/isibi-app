import { ClipboardBlocked } from "@/components/ui/clipboard-blocked";
import { cn } from "@/lib/utils";
/**
 * A public embed key, with the reason it is safe to publish.
 *
 * IT SAYS THIS ONE IS MEANT TO BE PUBLIC. A key that appears in page source
 * looks like a leak to anybody security-minded, and they either refuse to embed
 * or file a report — so the sentence explaining that it is a publishable
 * identifier saves both.
 *
 * IT NAMES WHAT ACTUALLY PROTECTS IT, which is the domain allow-list rather
 * than the key's secrecy. Somebody who understands that configures the
 * allow-list; somebody who thinks the key is the protection leaves it open.
 *
 * NO-DOMAINS-SET IS THE DANGEROUS STATE and is called out. An unrestricted
 * public key works from anywhere, including somebody else's site burning your
 * quota — and it is the default when nobody has been told.
 *
 * IT IS VISUALLY DISTINCT FROM `signature-secret`, which is masked. Two things
 * that look alike and have opposite handling rules is how a real secret ends up
 * in a page.
 */
export function WidgetKey({ value, domains = [], className }: {
  value: string;
  /** Domains allowed to use it. */
  domains?: string[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-2 rounded-md border border-border p-3", className)}>
      <p className="text-sm font-medium">Embed key</p>
      <p className="text-xs text-muted-foreground">
        This is meant to be public — it goes in your page source and anyone can read it. It is not a password.
      </p>
      <ClipboardBlocked value={value} label="" />
      {domains.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Only works on {domains.join(", ")}. That is what protects it, not the key itself.
        </p>
      ) : (
        <p className="text-xs">
          <span className="font-medium">No domains set — this key works from anywhere.</span>
          <span className="text-muted-foreground"> Add your own domains so nobody else can use it.</span>
        </p>
      )}
    </div>
  );
}
