import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * Folding several near-duplicate tags into one.
 *
 * THE SENTENCE IS SPELLED OUT BEFORE THE BUTTON — "412 items move to 'urgent';
 * 3 tags disappear". A merge is irreversible in most systems and the operation
 * is described by two numbers, so stating both is the difference between an
 * informed action and a hopeful one.
 *
 * THE SURVIVOR IS CHOSEN EXPLICITLY, never inferred from the biggest or the
 * oldest. Which spelling wins is a naming decision — "Urgent" or "urgent" — and
 * guessing it silently is how a merge produces the wrong canonical name and has
 * to be undone by hand.
 *
 * THE SURVIVOR CANNOT ALSO BE A SOURCE. Merging a tag into itself is a no-op at
 * best and a delete at worst, so it is filtered out of the source list rather
 * than left as a foot-gun.
 *
 * `onMerge` gets ids, never names, because two tags with the same displayed
 * name is the exact condition this component exists to clean up.
 */
export type MergeTag = { id: string; name: string; count?: number };

export function TagMerge({ tags, onMerge, onCancel, busy, className }: {
  tags: MergeTag[];
  onMerge: (v: { keep: string; remove: string[] }) => void;
  onCancel?: () => void;
  busy?: boolean;
  className?: string;
}) {
  const [keep, setKeep] = useState(tags[0]?.id ?? "");
  const [remove, setRemove] = useState<string[]>([]);
  const sources = tags.filter((t) => t.id !== keep);
  const picked = remove.filter((id) => id !== keep);
  const moving = picked.reduce((n, id) => n + (tags.find((t) => t.id === id)?.count ?? 0), 0);
  const keepName = tags.find((t) => t.id === keep)?.name ?? "";
  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-1">
        <label htmlFor="merge-keep" className="block text-sm font-medium">Keep this one</label>
        <NativeSelect id="merge-keep" value={keep} onChange={(e) => setKeep(e.target.value)}>
          {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </NativeSelect>
      </div>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Merge these into it</legend>
        {sources.map((t) => (
          <label key={t.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={picked.includes(t.id)} className="size-4 accent-foreground"
              onChange={(e) => setRemove((r) => e.target.checked ? [...r, t.id] : r.filter((x) => x !== t.id))} />
            <span className="min-w-0 truncate">{t.name}</span>
            {t.count !== undefined && <span className="ml-auto text-xs tabular-nums text-muted-foreground">{t.count.toLocaleString()}</span>}
          </label>
        ))}
      </fieldset>
      <p className="text-sm text-muted-foreground">
        {picked.length === 0
          ? "Nothing selected to merge."
          : <><span className="font-medium text-foreground tabular-nums">{moving.toLocaleString()}</span> items move to “{keepName}”, and {picked.length} {picked.length === 1 ? "tag disappears" : "tags disappear"}.</>}
      </p>
      <div className="flex gap-2">
        <Button type="button" disabled={!picked.length || busy} onClick={() => onMerge({ keep, remove: picked })}>Merge</Button>
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>}
      </div>
    </div>
  );
}
