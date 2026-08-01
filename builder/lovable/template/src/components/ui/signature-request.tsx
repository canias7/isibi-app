import { DateFormat } from "@/components/ui/date-format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Who still has to sign, and who already has.
 *
 * SIGNED PARTIES KEEP THEIR TIMESTAMP. A list showing only who is outstanding
 * cannot answer "when did Ana sign", which is the question asked when a document
 * is disputed — and that is the only moment this screen matters.
 *
 * ORDER IS RESPECTED WHEN IT EXISTS. Some documents must be signed in sequence,
 * and showing a later party as merely "waiting" when they cannot yet act is
 * misleading; "waiting for Sam first" is the honest state.
 *
 * The reminder names the person, since a page of identical "Remind" buttons is
 * unusable with a screen reader and easy to misfire with a mouse.
 */
export type Signatory = { name: string; signedAt?: string | number | Date | null; blockedBy?: string };

export function SignatureRequest({ signatories, onRemind, className }: {
  signatories: Signatory[];
  onRemind?: (name: string) => void;
  className?: string;
}) {
  if (!signatories.length) return null;
  const outstanding = signatories.filter((s) => !s.signedAt).length;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-sm font-medium tabular-nums">
        {outstanding === 0 ? "Everyone has signed" : `Waiting on ${outstanding} of ${signatories.length}`}
      </p>
      <ul className="divide-y divide-border text-sm">
        {signatories.map((s) => (
          <li key={s.name} className="flex flex-wrap items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="truncate">{s.name}</span>
              <span className="block text-xs text-muted-foreground">
                {s.signedAt
                  ? <>Signed <time dateTime={new Date(s.signedAt).toISOString()}><DateFormat date={s.signedAt} withTime /></time></>
                  : s.blockedBy ? `Waiting for ${s.blockedBy} first` : "Not signed yet"}
              </span>
            </span>
            {onRemind && !s.signedAt && !s.blockedBy && (
              <Button size="sm" variant="outline" onClick={() => onRemind(s.name)}>
                Remind<span className="sr-only"> {s.name}</span>
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
