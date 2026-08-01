import { cn } from "@/lib/utils";
/**
 * What this file is, and what opens it.
 *
 * AN EXTENSION IS NOT AN EXPLANATION. ".dwg" and ".heic" mean nothing to most
 * people, and a download that cannot be opened is indistinguishable from a
 * broken one — which is what gets reported.
 *
 * IT NAMES SOMETHING THAT OPENS IT, because that is the actionable half. "CAD
 * drawing — opens in AutoCAD or a free viewer" turns a dead end into a next
 * step.
 *
 * NO ICONS BY FILE TYPE. A grid of coloured document glyphs is meaningless
 * without the words anyway, and maintaining a set of them is a licensing and
 * upkeep cost for something the label already does.
 */
export function FileTypeNote({ extension, describes, opensWith, className }: {
  /** ".dwg" */
  extension: string;
  /** "CAD drawing" */
  describes: string;
  /** "AutoCAD, or a free viewer" */
  opensWith?: string;
  className?: string;
}) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      <span className="font-medium text-foreground">{extension.replace(/^\.?/, ".")}</span>
      {" — "}{describes}
      {opensWith && <> · opens in {opensWith}</>}
    </p>
  );
}
