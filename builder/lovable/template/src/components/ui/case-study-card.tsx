import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
/** A customer story with the number that makes it a story. */
export function CaseStudyCard({ client, headline, result, image, href, className }: {
  client: string; headline: string; result?: { value: string; label: string };
  image?: string | null; href?: string; className?: string;
}) {
  return (
    <a href={href} className={cn("group flex flex-col gap-3 rounded-xl border p-4 hover:bg-muted/40", className)}>
      <SafeImage src={image} alt={client} ratio="16/9" />
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{client}</div>
        <div className="mt-1 font-medium text-balance group-hover:underline underline-offset-4">{headline}</div>
      </div>
      {result && (
        <div className="mt-auto border-t pt-3">
          <span className="text-2xl font-semibold tabular-nums">{result.value}</span>
          <span className="ml-2 text-sm text-muted-foreground">{result.label}</span>
        </div>
      )}
    </a>
  );
}
