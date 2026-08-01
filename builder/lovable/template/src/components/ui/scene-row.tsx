import { cn } from "@/lib/utils";
/**
 * A scene in a schedule — with the standard shorthand written out.
 *
 * INT/EXT AND DAY/NIGHT ARE THE TWO FACTS THAT SCHEDULE A FILM. Exteriors are
 * weather-dependent and night work costs more and needs different crew, so a
 * scene list without them cannot be ordered into days at all.
 *
 * PAGE COUNT IS IN EIGHTHS, because that is the unit the industry estimates in
 * and a decimal is silently converted wrongly. A day is measured in pages, and
 * a schedule that measures scenes instead is wrong by a factor of ten.
 *
 * THE CAST NUMBERS ARE SHOWN. Scheduling is mostly about not paying somebody to
 * sit in a hotel, and which numbered cast members a scene needs is what makes
 * that possible.
 *
 * SCRIPT DAY IS NOT SHOOTING DAY. Scenes shot on the same day can be script
 * days apart, which decides continuity of costume and injury — and conflating
 * them is the classic continuity error.
 */
export function SceneRow({ scene, slug, interior, night, pageEighths, cast = [], scriptDay, summary, className }: {
  /** "14A". */
  scene: string;
  /** The location line — "Kitchen, Ashworth house". */
  slug?: string;
  interior?: boolean;
  night?: boolean;
  /** Length in eighths of a page. */
  pageEighths?: number;
  /** Numbered cast required. */
  cast?: (string | number)[];
  /** Which day of the story. */
  scriptDay?: string;
  summary?: string;
  className?: string;
}) {
  const pages = pageEighths !== undefined
    ? `${Math.floor(pageEighths / 8) || ""}${pageEighths % 8 ? ` ${pageEighths % 8}/8` : ""}`.trim() || "0"
    : undefined;
  return (
    <li className={cn("space-y-0.5 px-3 py-1.5 text-sm", className)}>
      <p className="flex items-baseline gap-3">
        <span className="w-10 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{scene}</span>
        <span className="min-w-0 flex-1">
          {slug ?? "No slug line"}
          <span className="block text-xs text-muted-foreground">
            {interior === undefined ? "Interior or exterior not set" : interior ? "Interior" : "Exterior"}
            {night !== undefined && ` · ${night ? "night" : "day"}`}
            {scriptDay && ` · script day ${scriptDay}`}
          </span>
        </span>
        {pages && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{pages} pp</span>
        )}
      </p>
      {summary && <p className="pl-13 text-xs">{summary}</p>}
      {cast.length > 0 && (
        <p className="text-xs tabular-nums text-muted-foreground">Cast {cast.join(", ")}</p>
      )}
    </li>
  );
}
