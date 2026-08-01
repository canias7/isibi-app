import { cn } from "@/lib/utils";
/**
 * One qualification, licence or certificate — with whether anyone checked it.
 *
 * "VERIFIED BY US" VS "AS TOLD TO US" IS THE ENTIRE POINT. A list of
 * qualifications where both appear identical is a list a customer cannot use,
 * and it quietly makes the platform responsible for claims it never checked.
 * The state is a word on every row, including the unchecked ones.
 *
 * THE ISSUING BODY IS AS IMPORTANT AS THE NAME. "Level 3 Diploma" from a
 * recognised board and from an unknown one are different things, and only the
 * issuer distinguishes them.
 *
 * A REFERENCE NUMBER IS SHOWN WHERE THERE IS ONE, because that is what makes a
 * claim independently checkable by somebody who cares enough to look it up —
 * which is the only real verification there is.
 *
 * A `<li>`, so `credential-row` composes into a list the way `sign-off-row`
 * does, and the caller owns the surrounding `<ul>`.
 */
export function CredentialRow({ name, issuer, reference, state = "claimed", awarded, action, className }: {
  name: string;
  issuer?: string;
  /** Registration or certificate number. */
  reference?: string;
  state?: "verified" | "claimed" | "expired";
  /** Free text — "March 2024". */
  awarded?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const word = state === "verified" ? "Checked by us" : state === "expired" ? "Expired" : "As told to us";
  return (
    <li className={cn("flex items-start gap-3 px-3 py-2 text-sm", className)}>
      <span className="min-w-0 flex-1">
        <span className={cn("block", state === "expired" && "text-muted-foreground")}>{name}</span>
        <span className="block text-xs text-muted-foreground">
          {issuer}
          {issuer && awarded ? " · " : ""}
          {awarded}
          {(issuer || awarded) && reference ? " · " : ""}
          {reference && <span>ref {reference}</span>}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className={cn("block text-xs", state === "verified" ? "font-medium" : "text-muted-foreground")}>{word}</span>
        {action}
      </span>
    </li>
  );
}
