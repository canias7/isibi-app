import { cn } from "@/lib/utils";
/** The top of a post: title, standfirst, and who wrote it when. */
export function ArticleHeader({ title, standfirst, meta, className }: {
  title: string; standfirst?: string; meta?: React.ReactNode; className?: string;
}) {
  return (
    <header data-slot="article-header" className={cn("flex flex-col gap-3 border-b pb-6", className)}>
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
      {standfirst && <p className="max-w-prose text-lg text-muted-foreground text-balance">{standfirst}</p>}
      {meta && <div className="flex flex-wrap items-center gap-3 pt-1">{meta}</div>}
    </header>
  );
}
