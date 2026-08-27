import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
/**
 * A URL-safe name, shown in place.
 *
 * It stops following the title the moment somebody edits the slug by hand —
 * a slug that keeps resyncing silently discards the edit, and the person only
 * finds out after the link is published.
 */
export function SlugInput({ value, onChange, from, prefix, id, className }: {
  value: string; onChange: (v: string) => void; from?: string;
  prefix?: string; id?: string; className?: string;
}) {
  const [touched, setTouched] = React.useState(false);
  const slugify = (s: string) =>
    s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  React.useEffect(() => {
    if (!touched && from != null) {
      const next = slugify(from);
      if (next !== value) onChange(next);
    }
    // `value` is deliberately not a dependency: this syncs FROM the title.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, touched]);
  return (
    <div data-slot="slug-input" className={cn("flex items-center gap-0", className)}>
      {prefix && <span className="shrink-0 rounded-s-md border border-e-0 border-input bg-muted px-2 py-1.5 text-sm text-muted-foreground">{prefix}</span>}
      <Input id={id} value={value} className={cn("font-mono", prefix && "rounded-s-none")}
        onChange={(e) => { setTouched(true); onChange(slugify(e.target.value)); }} />
    </div>
  );
}
