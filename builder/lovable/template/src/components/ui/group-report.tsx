import { cn } from "@/lib/utils";
/**
 * A group figure — with the spread, which is the actual finding.
 *
 * THE RANGE MATTERS MORE THAN THE TOTAL. A group averaging well with one
 * branch collapsing is a different business from one where every branch is
 * mediocre, and a single number cannot tell them apart. Best, median and worst
 * together can.
 *
 * SITES OPENED OR CLOSED MID-PERIOD DISTORT EVERY COMPARISON, and the count is
 * shown. A group "up 8%" that opened four branches has not grown 8% at the
 * branches it already had, which is the number anybody actually wants.
 *
 * LIKE-FOR-LIKE IS SHOWN SEPARATELY WHERE THE CALLER HAS IT, because it is the
 * only figure comparable to last year and it is routinely buried under a total
 * that flatters.
 *
 * NO TRAFFIC-LIGHT COLOURS. This is printed for a board pack and read in
 * greyscale, and a report that depends on red and green loses its meaning on
 * the way to the meeting.
 */
export function GroupReport({ metric, total, unit, best, median, worst, bestSite, worstSite, sitesOpened = 0, sitesClosed = 0, likeForLikeChange, period, className }: {
  metric: string;
  total?: number;
  unit?: string;
  best?: number;
  median?: number;
  worst?: number;
  bestSite?: string;
  worstSite?: string;
  sitesOpened?: number;
  sitesClosed?: number;
  /** Change at sites open in both periods, 0–1. */
  likeForLikeChange?: number;
  period?: string;
  className?: string;
}) {
  const u = unit ?? "";
  const pct = (v: number) =>
    new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1, signDisplay: "never" }).format(Math.abs(v));
  return (
    <div data-slot="group-report" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium">{metric}</span>
        {period && <span className="text-muted-foreground"> · {period}</span>}
      </p>
      {total !== undefined && (
        <p className="tabular-nums">{u}{total.toLocaleString()} across the group</p>
      )}
      {(best !== undefined || median !== undefined || worst !== undefined) && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {best !== undefined && `Best ${u}${best.toLocaleString()}${bestSite ? ` (${bestSite})` : ""}`}
          {median !== undefined && ` · median ${u}${median.toLocaleString()}`}
          {worst !== undefined && ` · worst ${u}${worst.toLocaleString()}${worstSite ? ` (${worstSite})` : ""}`}
        </p>
      )}
      {likeForLikeChange !== undefined && (
        <p className="text-xs tabular-nums">
          <span className="font-medium">
            {pct(likeForLikeChange)} {likeForLikeChange >= 0 ? "up" : "down"} like for like
          </span>
          <span className="text-muted-foreground"> — sites open in both periods only.</span>
        </p>
      )}
      {(sitesOpened > 0 || sitesClosed > 0) && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {sitesOpened > 0 && `${sitesOpened} ${sitesOpened === 1 ? "site" : "sites"} opened`}
          {sitesOpened > 0 && sitesClosed > 0 ? " · " : ""}
          {sitesClosed > 0 && `${sitesClosed} closed`}
          {" — the group total is not comparable with last year because of that."}
        </p>
      )}
    </div>
  );
}
