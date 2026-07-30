import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
/**
 * "Do you come out to me?"
 *
 * The full list is shown as well as the checker, and that is deliberate: a
 * lookup box alone means somebody whose town is not listed types it, gets
 * "no", and never learns the next town over is covered. Seeing the list
 * answers the question the box cannot.
 *
 * Matching is case- and space-insensitive on both sides, because people type
 * postcodes as "L14ds" and "L1 4DS" in roughly equal numbers.
 */
export function ServiceArea({ areas, note, placeholder = "Your postcode or town", className }: {
  areas: string[]; note?: string; placeholder?: string; className?: string;
}) {
  const [q, setQ] = React.useState("");
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  const asked = q.trim().length >= 2;
  const hit = asked && areas.find((a) => norm(a).startsWith(norm(q)) || norm(q).startsWith(norm(a)));
  return (
    <div className={cn("space-y-3", className)}>
      <Input value={q} placeholder={placeholder} aria-label="Check your area"
        onChange={(e) => setQ(e.target.value)} />
      {asked && (
        <p className={cn("text-sm", hit ? "text-success" : "text-muted-foreground")} aria-live="polite">
          {hit ? <>Yes — we cover <strong className="font-medium">{hit}</strong>.</>
            : <>We don't list that one. Get in touch and we'll tell you.</>}
        </p>
      )}
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Areas we cover</p>
        <p className="mt-1 text-sm">{areas.join(" · ")}</p>
        {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      </div>
    </div>
  );
}
