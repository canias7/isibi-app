import { cn } from "@/lib/utils";
/**
 * The plain-English answer, in one line.
 *
 * A SENTENCE, NOT A SETTING. `share-scope` is the control; this is the summary
 * that sits on the item itself so nobody has to open a dialog to find out
 * whether something is private. The commonest privacy accident is not choosing
 * wrongly — it is never checking.
 *
 * THE WIDE STATES READ AS WIDE. "Anyone with the link" is bold and unqualified;
 * "Only you" is muted. Weight rather than colour, so it survives greyscale and
 * says the same thing to a screen reader.
 *
 * The count is included when there is one, because "3 people" prompts a check
 * where "Shared" does not.
 */
export function WhoCanSee({ scope, count, orgName, className }: {
  scope: "private" | "invited" | "org" | "link";
  /** How many people, for the invited case. */
  count?: number;
  orgName?: string;
  className?: string;
}) {
  const wide = scope === "link" || scope === "org";
  const text =
    scope === "private" ? "Only you"
    : scope === "invited" ? `${count ?? 0} ${count === 1 ? "person" : "people"}`
    : scope === "org" ? `Anyone at ${orgName ?? "your organisation"}`
    : "Anyone with the link";
  return (
    <p data-slot="who-can-see" className={cn("text-sm", wide ? "font-medium" : "text-muted-foreground", className)}>
      <span className="sr-only">Visible to: </span>{text}
    </p>
  );
}
