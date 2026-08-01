import { cn } from "@/lib/utils";
/**
 * The footer every marketing email needs, with the parts that are compulsory.
 *
 * WHY THEY ARE RECEIVING IT IS AS IMPORTANT AS THE UNSUBSCRIBE LINK. "You are
 * getting this because you booked with us in March" prevents the spam report —
 * which costs far more than an unsubscribe, because it damages delivery for
 * everybody on the list.
 *
 * THE POSTAL ADDRESS IS REQUIRED IN SEVERAL PLACES AND IS THE PART ALWAYS
 * MISSING. It is also what makes an email look like it came from a real
 * business rather than a bot.
 *
 * ONE-CLICK UNSUBSCRIBE IS OFFERED WHERE THE CALLER SUPPORTS IT. A link that
 * leads to a sign-in and a preference centre is the pattern that gets people
 * pressing "report spam" instead, which is worse for the sender in every way.
 *
 * IT IS NOT TINY GREY TEXT. Hiding the unsubscribe is the behaviour that gets
 * senders blocked — the same reasoning `disclosure-block` applies, and it is
 * cheaper to be findable.
 */
export function UnsubscribeFooter({ why, unsubscribeUrl, preferencesUrl, postalAddress, senderName, className }: {
  /** Why they are on the list. */
  why: string;
  unsubscribeUrl: string;
  /** For changing what they get rather than stopping everything. */
  preferencesUrl?: string;
  /** Required in many places. */
  postalAddress?: string;
  senderName?: string;
  className?: string;
}) {
  return (
    <footer className={cn("space-y-1 border-t border-border pt-2 text-sm", className)}>
      <p className="text-muted-foreground">{why}</p>
      <p>
        <a href={unsubscribeUrl} className="underline underline-offset-2">Unsubscribe</a>
        {preferencesUrl && (
          <>
            <span className="text-muted-foreground"> · </span>
            <a href={preferencesUrl} className="underline underline-offset-2">Choose what you get</a>
          </>
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        {senderName}
        {senderName && postalAddress ? ", " : ""}
        {postalAddress ?? (senderName ? "" : null)}
        {!postalAddress && (
          <span className="text-foreground">No postal address — this is required in many places.</span>
        )}
      </p>
    </footer>
  );
}
