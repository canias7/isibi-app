import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
/**
 * The lead story, at lead size.
 *
 * WHY THIS IS NOT JUST A BIG CARD. A feed is chronological and a newsroom
 * EDITS — the lead is a judgement about what matters most today, and if it
 * renders at the same weight as everything under it that judgement is invisible
 * and the page is a feed again. So the picture is 16/9 and full width, the
 * headline steps up two sizes, and the standfirst exists at all.
 *
 * THE WHOLE BLOCK IS ONE LINK, wrapped so the picture, headline and standfirst
 * are a single target rather than three — a headline-only hit area on a phone is
 * the most-missed tap on a news page. The byline sits OUTSIDE it, because a
 * reader tapping a journalist's name expects that journalist, not the story.
 *
 * `kicker` is the section, not a label: "Planning" above a headline tells a
 * local reader whether this is theirs in one word.
 */
export function StoryLead({
  headline, standfirst, href, image, imageAlt, kicker, byline, when, className,
}: {
  headline: string;
  standfirst?: string;
  href?: string;
  image?: string | null;
  imageAlt?: string;
  /** The section this is filed under. */
  kicker?: string;
  byline?: string;
  /** Already formatted — the newsroom decides whether that is a date or "2 hours ago". */
  when?: string;
  className?: string;
}) {
  const body = (
    <>
      <SafeImage src={image} alt={imageAlt ?? headline} ratio="16/9" className="rounded-lg" />
      {kicker && (
        <p className="mt-4 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{kicker}</p>
      )}
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{headline}</h2>
      {standfirst && (
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">{standfirst}</p>
      )}
    </>
  );
  return (
    <article className={cn("", className)}>
      {href
        ? <a href={href} className="group block focus-visible:outline-none [&_h2]:group-hover:underline [&_h2]:underline-offset-4">{body}</a>
        : body}
      {(byline || when) && (
        <p className="mt-3 text-sm text-muted-foreground">
          {byline && <span className="font-medium text-foreground">{byline}</span>}
          {byline && when && " · "}
          {when}
        </p>
      )}
    </article>
  );
}
