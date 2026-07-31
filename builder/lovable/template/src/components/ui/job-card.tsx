import { Badge } from "@/components/ui/badge";
import { TimeAgo } from "@/components/ui/time-ago";
import { MapPin, Briefcase, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A vacancy.
 *
 * Salary renders when it is there and the row simply closes up when it is not
 * — no "Competitive" placeholder, which tells a candidate nothing and makes
 * the listing look like it is hiding something.
 */
export function JobCard({ title, team, location, type, salary, postedAt, href, tags, className }: {
  title: string; team?: string; location?: string; type?: string; salary?: string;
  postedAt?: string | number | Date; href?: string; tags?: string[]; className?: string;
}) {
  return (
    <article className={cn("rounded-lg border border-border p-4", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">{href ? <a href={href} className="hover:underline">{title}</a> : title}</h3>
        {postedAt && <span className="text-xs text-muted-foreground"><TimeAgo date={postedAt} /></span>}
      </div>
      {team && <p className="mt-0.5 text-sm text-muted-foreground">{team}</p>}
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {location && <li className="flex items-center gap-1.5"><MapPin className="size-3.5" />{location}</li>}
        {type && <li className="flex items-center gap-1.5"><Briefcase className="size-3.5" />{type}</li>}
        {salary && <li className="flex items-center gap-1.5"><Banknote className="size-3.5" />{salary}</li>}
      </ul>
      {tags?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((t) => <Badge key={t} variant="secondary" className="font-normal">{t}</Badge>)}
        </div>
      ) : null}
    </article>
  );
}
