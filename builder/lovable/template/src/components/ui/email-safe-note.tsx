import { cn } from "@/lib/utils";
/**
 * What email clients will break in a template, listed before it is sent.
 *
 * EMAIL IS NOT THE WEB AND THIS IS THE COMPONENT THAT SAYS WHICH BITS. Flexbox,
 * grid, custom properties, `<style>` blocks, web fonts and background images
 * are all silently dropped or mangled by one client or another — usually
 * Outlook — and the result reaches a customer looking broken, having looked
 * perfect in the preview.
 *
 * IT NAMES THE CLIENT, because "may not work everywhere" is unactionable while
 * "Outlook on Windows ignores this" is a decision about whether that audience
 * matters. Every one of these problems is client-specific.
 *
 * IT SAYS WHAT HAPPENS, not just that something is unsupported. A dropped
 * background colour is cosmetic; a dropped flex layout stacks the whole email
 * into one column and can hide the button entirely.
 *
 * IT DOES NOT BLOCK SENDING. Plenty of lists are overwhelmingly on clients that
 * cope, and the sender knows their audience better than a rule does.
 */
export type EmailIssue = { id: string; feature: string; clients: string; effect: string; severe?: boolean };

export function EmailSafeNote({ issues, allClearNote = "Nothing here that email clients commonly break", className }: {
  issues: EmailIssue[];
  allClearNote?: string;
  className?: string;
}) {
  if (!issues.length) {
    return <p data-slot="email-safe-note" className={cn("text-sm text-muted-foreground", className)}>{allClearNote}</p>;
  }
  const severe = issues.filter((i) => i.severe);
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm">
        {severe.length > 0
          ? <><span className="font-medium tabular-nums">{severe.length}</span> of these will break the layout</>
          : <span className="text-muted-foreground">{issues.length} things some clients handle differently</span>}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {issues.map((i) => (
          <li key={i.id} className="px-3 py-2">
            <p className={cn(i.severe && "font-medium")}>{i.feature}</p>
            <p className="text-xs text-muted-foreground">{i.clients} — {i.effect}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
