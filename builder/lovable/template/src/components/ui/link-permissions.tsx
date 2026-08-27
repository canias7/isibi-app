import { NativeSelect } from "@/components/ui/native-select";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";
/**
 * The share link, and what holding it lets you do.
 *
 * THE PERMISSION SITS NEXT TO THE COPY BUTTON. Copying a link and setting its
 * access in two different places is how an edit link gets sent to somebody who
 * should only view — the two decisions are one decision and belong together.
 *
 * THE LINK IS NOT SHOWN AS EDITABLE TEXT. A share URL in an input invites
 * somebody to change it, and a hand-edited share link is a broken link that
 * looks fine.
 *
 * `expires` is shown inline when set, because a link that stops working next
 * Tuesday is something the sender needs to know before pasting it into an email.
 */
export function LinkPermissions({ url, level, levels, onLevelChange, expires, className }: {
  url: string;
  level: string;
  levels: { value: string; label: string }[];
  onLevelChange: (v: string) => void;
  /** "Expires 8 August" */
  expires?: string;
  className?: string;
}) {
  return (
    <div data-slot="link-permissions" className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs select-all">
          {url}
        </code>
        <NativeSelect value={level} aria-label="What the link allows" className="h-9 w-auto text-sm"
          onChange={(e) => onLevelChange(e.target.value)}>
          {levels.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </NativeSelect>
        <CopyButton value={url} label="Copy share link" />
      </div>
      {expires && <p className="text-xs text-muted-foreground">{expires}</p>}
    </div>
  );
}
