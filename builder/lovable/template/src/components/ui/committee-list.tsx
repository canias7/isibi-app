import { cn } from "@/lib/utils";
/**
 * Who runs the club — with the vacancies, which is the point of publishing it.
 *
 * VACANT POSTS ARE LISTED AS POSTS, not omitted. A committee page showing four
 * filled roles looks complete; the same page showing four filled and three
 * vacant is a recruitment advert, and it is the only one most small clubs ever
 * run.
 *
 * TERM END DATES ARE SHOWN. Officers serve fixed terms and almost nobody knows
 * when theirs ends, which is why the same people do the same jobs for a decade
 * and then all leave at once.
 *
 * IT DOES NOT PUBLISH PERSONAL CONTACT DETAILS. A committee page is a public
 * page and a home email address on it is scraped within days; a role-based
 * address is the same usefulness with none of the exposure.
 *
 * WHO IS A TRUSTEE IS MARKED where a club has them, because trustees carry
 * legal duties that committee members do not, and members are entitled to know
 * which is which.
 */
export type CommitteePost = {
  id: string;
  role: string;
  holder?: string;
  /** Role-based, never personal. */
  contact?: string;
  /** Free text — "AGM 2027". */
  termEnds?: string;
  trustee?: boolean;
  /** What the post actually involves. */
  about?: string;
};

export function CommitteeList({ posts, className }: { posts: CommitteePost[]; className?: string }) {
  const vacant = posts.filter((p) => !p.holder);
  return (
    <div className={cn("space-y-1.5", className)}>
      {vacant.length > 0 && (
        <p className="text-sm font-medium">
          {vacant.length} {vacant.length === 1 ? "post is" : "posts are"} vacant: {vacant.map((p) => p.role).join(", ")}.
        </p>
      )}
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {posts.map((p) => (
          <li key={p.id} className="space-y-0.5 px-3 py-1.5">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="min-w-0 flex-1">
                {p.role}
                {p.trustee && <span className="text-xs text-muted-foreground"> · trustee</span>}
              </span>
              <span className={cn("shrink-0 text-xs", p.holder ? "text-muted-foreground" : "font-medium")}>
                {p.holder ?? "Vacant"}
              </span>
            </p>
            {p.about && <p className="text-xs text-muted-foreground">{p.about}</p>}
            {(p.contact || p.termEnds) && (
              <p className="text-xs text-muted-foreground">
                {p.contact}
                {p.contact && p.termEnds ? " · " : ""}
                {p.termEnds && `term ends ${p.termEnds}`}
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Addresses here go to the role, not to a person's own inbox.
      </p>
    </div>
  );
}
