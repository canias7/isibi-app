import { cn } from "@/lib/utils";
/**
 * Whether a theme is actually usable, checked before it is published.
 *
 * IT CHECKS THE THINGS THAT ARE INVISIBLE UNTIL A CUSTOMER HITS THEM — text
 * contrast, a logo that vanishes on dark, a font with no bold weight, a colour
 * that means nothing in greyscale. Each of these looks perfect on the settings
 * page and fails somewhere else, which is exactly why they need a checklist
 * rather than an eye.
 *
 * PROBLEMS AND WARNINGS ARE SEPARATE. Failing contrast is a problem — it makes
 * text unreadable; a slightly unusual pairing is a warning. Treating them the
 * same either blocks a fine theme or lets an unreadable one through.
 *
 * EACH ITEM SAYS WHERE IT SHOWS UP. "Low contrast" is abstract; "the button
 * label on your primary colour" is a place somebody can look.
 *
 * IT DOES NOT BLOCK PUBLISHING. It is the customer's brand, and a tool that
 * refuses their colours is one they work around by giving up on the theme.
 */
export type BrandIssue = { id: string; text: string; where?: string; warning?: boolean };

export function BrandCheck({ issues, allClearNote = "Nothing obviously wrong", className }: {
  issues: BrandIssue[];
  allClearNote?: string;
  className?: string;
}) {
  if (!issues.length) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{allClearNote}</p>;
  }
  const problems = issues.filter((i) => !i.warning);
  const warnings = issues.filter((i) => i.warning);
  const section = (title: string, items: BrandIssue[], strong: boolean) =>
    items.length > 0 && (
      <div>
        <p className={cn("text-xs font-medium", !strong && "text-muted-foreground")}>{title}</p>
        <ul className="space-y-0.5 text-sm">
          {items.map((i) => (
            <li key={i.id} className="flex gap-2">
              <span aria-hidden="true" className="text-muted-foreground">·</span>
              <span className="min-w-0">
                {i.text}
                {i.where && <span className="block text-xs text-muted-foreground">{i.where}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  return (
    <div className={cn("space-y-2", className)}>
      {section(problems.length === 1 ? "One thing to fix" : `${problems.length} things to fix`, problems, true)}
      {section("Worth a look", warnings, false)}
    </div>
  );
}
