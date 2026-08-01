import { cn } from "@/lib/utils";
/**
 * Who wrote it — including the people a byline usually omits.
 *
 * PHOTOGRAPHERS, ILLUSTRATORS AND TRANSLATORS ARE CREDITED IN THE SAME
 * STRUCTURE. A byline listing only writers is why picture credits end up in
 * six-point type in a gutter, and why translators are routinely left off
 * entirely. Same field, same prominence, different role.
 *
 * AN ANONYMOUS BYLINE SAYS WHY. "By our correspondent" for safety reasons and
 * an unattributed press release are different things, and a reader is entitled
 * to know which.
 *
 * A CONFLICT OF INTEREST IS DECLARED HERE, at the top, not in a footer.
 * Disclosure placed after the article has been read is disclosure that did not
 * work.
 *
 * THE DATE IS SEPARATED FROM THE UPDATE DATE. A piece written in 2019 and
 * updated last week is a different document from one written last week, and
 * showing one date lets an old article read as new.
 */
export type Contributor = { id: string; name: string; role?: string };

export function BylineRow({ contributors, anonymous, anonymousReason, publishedOn, updatedOn, disclosure, className }: {
  contributors?: Contributor[];
  anonymous?: boolean;
  /** Why there is no name. */
  anonymousReason?: string;
  publishedOn?: string;
  updatedOn?: string;
  /** Any interest the reader should know about. */
  disclosure?: string;
  className?: string;
}) {
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  const byRole = (contributors ?? []).reduce<Record<string, string[]>>((acc, c) => {
    const role = c.role ?? "Words";
    (acc[role] ??= []).push(c.name);
    return acc;
  }, {});
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      {anonymous ? (
        <p>
          No byline.
          <span className="block text-xs text-muted-foreground">
            {anonymousReason ?? "No reason has been given for withholding the author's name."}
          </span>
        </p>
      ) : (
        Object.entries(byRole).map(([role, names]) => (
          <p key={role} className="text-xs">
            <span className="text-muted-foreground">{role}: </span>
            {AND.format(names)}
          </p>
        ))
      )}
      {(publishedOn || updatedOn) && (
        <p className="text-xs text-muted-foreground">
          {publishedOn && `Published ${publishedOn}`}
          {publishedOn && updatedOn ? " · " : ""}
          {updatedOn && `updated ${updatedOn}`}
        </p>
      )}
      {disclosure && <p className="text-xs font-medium">{disclosure}</p>}
    </div>
  );
}
