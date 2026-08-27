import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
/**
 * Evidence that goods were handed over — the record a claim rests on.
 *
 * A NAME IS WORTH MORE THAN A SIGNATURE. A scrawl on a handheld proves
 * somebody touched a screen; a printed name plus a time plus a piece count is
 * what settles a dispute about whether four pallets or three left the yard.
 *
 * THE PIECE COUNT IS PART OF THE PROOF. Signed-for-one-pallet on a
 * three-pallet consignment is a partial collection, and every claim about a
 * short delivery turns on whether the count was recorded at handover.
 *
 * DAMAGE NOTED AT COLLECTION IS THE DECIDING EVIDENCE. Goods signed for clean
 * and reported damaged later are the carrier's strongest defence — so a
 * condition note taken at the point of handover is worth more than any
 * photograph taken afterwards.
 *
 * `SafeImage` on the signature and photo, since one or both are usually
 * missing at the moment the record is first shown.
 */
export function ProofOfCollection({ signedName, at, pieces, expectedPieces, condition, signature, photo, by, className }: {
  /** The printed name, not the scrawl. */
  signedName?: string;
  /** Free text — "14 August, 09:42". */
  at?: string;
  /** How many were actually handed over. */
  pieces?: number;
  expectedPieces?: number;
  /** Damage or condition noted at handover. */
  condition?: string;
  signature?: string;
  photo?: string;
  /** Our driver. */
  by?: string;
  className?: string;
}) {
  const short = pieces !== undefined && expectedPieces !== undefined && pieces < expectedPieces;
  return (
    <div data-slot="proof-of-collection" className={cn("space-y-1.5 text-sm", className)}>
      <p>
        {signedName
          ? <>Signed by <span className="font-medium">{signedName}</span></>
          : <span className="font-medium">Nobody named — a signature alone proves very little</span>}
        {at && <span className="text-muted-foreground">, {at}</span>}
        {by && <span className="block text-xs text-muted-foreground">Collected by {by}</span>}
      </p>
      {pieces !== undefined && (
        <p className={cn("text-xs", short && "font-medium")}>
          <span className="tabular-nums">{pieces}</span>
          {expectedPieces !== undefined && <span className="tabular-nums"> of {expectedPieces}</span>} pieces
          {short && " — short at collection"}
        </p>
      )}
      <p className="text-xs">
        {condition
          ? <><span className="text-muted-foreground">Condition noted: </span>{condition}</>
          : <span className="text-muted-foreground">Signed clean — damage reported later is much harder to claim.</span>}
      </p>
      {(signature !== undefined || photo !== undefined) && (
        <div className="flex gap-2">
          {signature !== undefined && (
            <SafeImage src={signature} alt="Signature" className="h-16 w-32 object-contain" />
          )}
          {photo !== undefined && (
            <SafeImage src={photo} alt="Photo at collection" className="size-16 object-cover" />
          )}
        </div>
      )}
    </div>
  );
}
