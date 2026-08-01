import { cn } from "@/lib/utils";
/**
 * What connecting an account will let us do, in plain sentences.
 *
 * SCOPES ARE TRANSLATED, NOT LISTED. `contacts.readonly offline_access` is what
 * the provider sends and what most consent screens print; nobody outside
 * engineering can weigh it. One sentence per permission, written as an action
 * we will take, is the only version somebody can actually consent to.
 *
 * WRITE PERMISSIONS ARE SEPARATED FROM READ AND LISTED FIRST. "Can read your
 * invoices" and "can create invoices in your name" are different risks, and a
 * flat list makes them look equivalent — which is how a write scope gets waved
 * through.
 *
 * WHAT WE WILL NOT DO IS STATED where the caller can say it. The absence of a
 * permission is invisible, and "we never see your bank login" is the sentence
 * that answers the actual worry.
 *
 * IT IS NOT THE CONSENT BUTTON. This describes; the provider's own screen is
 * where consent is given, and pretending otherwise would be the dark pattern
 * this component exists to avoid.
 */
export function OauthConsentSummary({ provider, writes = [], reads = [], never = [], className }: {
  provider: string;
  /** Things we will be able to change. */
  writes?: string[];
  /** Things we will be able to see. */
  reads?: string[];
  /** Things this does not allow. */
  never?: string[];
  className?: string;
}) {
  const list = (title: string, items: string[], strong?: boolean) =>
    items.length > 0 && (
      <div>
        <p className={cn("text-xs font-medium", !strong && "text-muted-foreground")}>{title}</p>
        <ul className="space-y-0.5 text-sm">
          {items.map((i) => (
            <li key={i} className="flex gap-2"><span aria-hidden="true">·</span><span>{i}</span></li>
          ))}
        </ul>
      </div>
    );
  return (
    <div className={cn("space-y-2.5", className)}>
      <p className="text-sm">Connecting {provider} will let us:</p>
      {list("Make changes", writes, true)}
      {list("See", reads)}
      {never.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">It does not let us</p>
          <ul className="space-y-0.5 text-sm text-muted-foreground">
            {never.map((i) => (
              <li key={i} className="flex gap-2"><span aria-hidden="true">·</span><span>{i}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
