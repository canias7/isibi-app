import { cn } from "@/lib/utils";
/**
 * The flatplan — pages in spreads, because that is how they are read.
 *
 * PAGES ARE PAIRED INTO SPREADS. A reader sees two facing pages at once, so an
 * advertisement opposite a related article, or two dark photographs facing each
 * other, is a decision made at the spread level. A linear list of pages cannot
 * express the only layout question that matters.
 *
 * RIGHT-HAND PAGES ARE ODD-NUMBERED AND ARE WORTH MORE. It is the fact that
 * decides advertising rates and where features start, and a plan that does not
 * distinguish them lets somebody sell a premium position that does not exist.
 *
 * AN EMPTY PAGE IS SHOWN AS EMPTY, LOUDLY. Unfilled pages this close to press
 * are the emergency, and a plan that renders them as blank space hides them
 * among the margins.
 *
 * NO THUMBNAILS. A flatplan of images is unreadable on a phone, unusable to a
 * screen reader, and slower to scan than the page numbers and titles that
 * everybody actually calls the pages by.
 */
export type PlanPage = {
  number: number;
  /** What is on it. */
  content?: string;
  kind?: "editorial" | "advertising" | "cover";
  /** True once the page is finished. */
  complete?: boolean;
};

export function PagePlan({ pages, className }: { pages: PlanPage[]; className?: string }) {
  const empty = pages.filter((p) => !p.content);
  // Paired into spreads: page 1 sits alone, then 2–3, 4–5, and so on, which is
  // how a reader meets them and how a designer decides anything.
  const spreads: PlanPage[][] = [];
  const sorted = [...pages].sort((a, b) => a.number - b.number);
  for (const p of sorted) {
    const last = spreads[spreads.length - 1];
    if (p.number % 2 === 0 || spreads.length === 0) spreads.push([p]);
    else if (last && last.length === 1 && last[0].number === p.number - 1) last.push(p);
    else spreads.push([p]);
  }
  return (
    <div data-slot="page-plan" className={cn("space-y-1.5", className)}>
      {empty.length > 0 && (
        <p className="text-sm font-medium">
          {empty.length} {empty.length === 1 ? "page has" : "pages have"} nothing on: {empty.map((p) => p.number).join(", ")}.
        </p>
      )}
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {spreads.map((s, i) => (
          <li key={i} className="flex gap-3 px-3 py-1.5">
            {s.map((p) => (
              <span key={p.number} className="min-w-0 flex-1">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {p.number}
                  {p.number % 2 === 1 ? " (right)" : ""}
                </span>
                <span className={cn("block", !p.content && "font-medium")}>
                  {/* `||`, not `??`: the empty check above is `!p.content`, so an
                      empty string counts in the summary and would render as a
                      blank row here — the one component disagreeing with itself. */}
                  {p.content || "Empty"}
                </span>
                {/* Joined from a filtered list: an absent kind is not a fact about
                    the page, and printing "not assigned" beside real content reads
                    as though the page itself were unassigned. */}
                <span className="block text-xs text-muted-foreground">
                  {[p.kind, p.content && !p.complete ? "not finished" : ""].filter(Boolean).join(" · ")}
                </span>
              </span>
            ))}
            {s.length === 1 && <span className="min-w-0 flex-1" aria-hidden="true" />}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Shown as spreads. Odd numbers are right-hand pages, which is what advertising pays extra for.
      </p>
    </div>
  );
}
