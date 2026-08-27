import { cn } from "@/lib/utils";
/**
 * Thanking somebody specifically — which is the only kind that works.
 *
 * IT REQUIRES SOMETHING SPECIFIC. A round-robin "thanks to all our wonderful
 * volunteers" is measurably worse than nothing at the individual level, because
 * it demonstrates that nobody noticed what any particular person did. The
 * component treats a missing specific as the omission it is.
 *
 * IT IS SIGNED BY A PERSON, NOT AN ORGANISATION. A note from "the team" is a
 * circular. A name makes it a message, and it is the same amount of typing.
 *
 * IT DOES NOT ASK FOR ANYTHING. A thank-you with a request attached is a
 * request, and volunteers recognise it immediately — the ask can be sent
 * separately and will do better for it.
 *
 * PUBLIC AND PRIVATE ARE DIFFERENT DECISIONS. Some people are delighted to be
 * named in a newsletter and some would rather not be, and being named without
 * being asked is a reason people stop.
 */
export function ThankYouNote({ to, forWhat, from, fromRole, sentOn, publicNaming, askedFirst, className }: {
  to: string;
  /** The specific thing, not "everything you do". */
  forWhat?: string;
  from?: string;
  fromRole?: string;
  sentOn?: string;
  /** True where this is going in a newsletter or on a wall. */
  publicNaming?: boolean;
  /** Whether the person agreed to be named. */
  askedFirst?: boolean;
  className?: string;
}) {
  return (
    <div data-slot="thank-you-note" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        Thank you, {to}
        {forWhat ? `, for ${forWhat}.` : "."}
      </p>
      {!forWhat && (
        <p className="text-xs font-medium">
          Nothing specific is named. A general thank-you tells somebody nobody noticed what they did.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {from ? `From ${from}${fromRole ? `, ${fromRole}` : ""}` : "Unsigned — a note from nobody in particular is a circular"}
        {sentOn && ` · ${sentOn}`}
      </p>
      {publicNaming && askedFirst !== true && (
        <p className="text-xs font-medium">
          This names them publicly and nobody has asked whether they mind.
        </p>
      )}
    </div>
  );
}
