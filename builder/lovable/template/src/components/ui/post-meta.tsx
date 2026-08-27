import { TimeAgo } from "@/components/ui/time-ago";
import { cn } from "@/lib/utils";
/** Date, category and reading time on one line, with proper separators. */
export function PostMeta({ date, category, readingTime, className }: {
  date?: string | number | Date; category?: string | null;
  readingTime?: React.ReactNode; className?: string;
}) {
  const bits = [
    date ? <TimeAgo key="d" date={date} /> : null,
    category ? <span key="c">{category}</span> : null,
    readingTime ? <span key="r">{readingTime}</span> : null,
  ].filter(Boolean);
  return (
    <div data-slot="post-meta" className={cn("flex flex-wrap items-center gap-2 text-sm text-muted-foreground", className)}>
      {bits.map((b, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden="true">·</span>}{b}
        </span>
      ))}
    </div>
  );
}
