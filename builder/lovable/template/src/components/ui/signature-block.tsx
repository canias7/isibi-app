import { SafeImage } from "@/components/ui/safe-image";
import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * Where a document is signed.
 *
 * The rule is always drawn, whether or not there is a signature on it: an
 * unsigned block has to look like somewhere to sign, and one that only
 * appears once signed gives a printed copy nowhere to put a pen.
 */
export function SignatureBlock({ name, role, signedAt, signature, label = "Signed", className }: {
  name?: string; role?: string; signedAt?: string | number | Date;
  signature?: string | null; label?: string; className?: string;
}) {
  return (
    <div data-slot="signature-block" className={cn("max-w-xs", className)}>
      <div className="flex h-16 items-end border-b border-foreground/60">
        {signature && <SafeImage src={signature} alt={name ? `${name}'s signature` : "Signature"}
          className="max-h-14 w-auto object-contain" />}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
      {name && <p className="text-sm font-medium">{name}</p>}
      {role && <p className="text-xs text-muted-foreground">{role}</p>}
      {signedAt && <p className="text-xs text-muted-foreground"><DateFormat date={signedAt} /></p>}
    </div>
  );
}
